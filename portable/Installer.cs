using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Windows.Forms;

internal static class Installer
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        using (var picker = new FolderBrowserDialog())
        {
            picker.Description = "Selecione a pasta que receberá OpenCode Infinite PT-BR.";
            if (picker.ShowDialog() != DialogResult.OK) return;
            var destination = Path.Combine(picker.SelectedPath, "OpenCode Infinite PT-BR");
            string staging = null;
            string payload = null;
            try
            {
                if (Directory.Exists(destination) || File.Exists(destination))
                    throw new IOException("A pasta de destino já existe. Escolha outro local.");
                staging = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
                Directory.CreateDirectory(staging);
                payload = staging + ".zip";
                using (var executable = File.OpenRead(Application.ExecutablePath))
                using (var reader = new BinaryReader(executable))
                using (var archive = File.Create(payload))
                {
                    executable.Seek(-8, SeekOrigin.End);
                    long start = reader.ReadInt64();
                    if (start <= 0 || start >= executable.Length - 8) throw new IOException("Instalador incompleto.");
                    executable.Position = start;
                    var buffer = new byte[1024 * 1024];
                    var remaining = executable.Length - 8 - start;
                    while (remaining > 0)
                    {
                        int count = executable.Read(buffer, 0, (int)Math.Min(remaining, buffer.Length));
                        if (count == 0) throw new EndOfStreamException();
                        archive.Write(buffer, 0, count);
                        remaining -= count;
                    }
                }
                ZipFile.ExtractToDirectory(payload, staging);
                Directory.Move(staging, destination);
                staging = null;
                var launcher = Path.Combine(destination, "portable", "Registrar atalhos.ps1");
                var shell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
                Process.Start(new ProcessStartInfo(shell,
                    "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + launcher + "\"") {
                    UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = destination
                });
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, "OpenCode Infinite PT-BR");
            }
            finally
            {
                if (payload != null && File.Exists(payload)) File.Delete(payload);
                if (staging != null && Directory.Exists(staging)) Directory.Delete(staging, true);
            }
        }
    }
}
