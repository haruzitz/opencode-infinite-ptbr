using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

internal static class Installer
{
    [STAThread]
    private static int Main(string[] args)
    {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        Application.EnableVisualStyles();
        if (args.Length == 4 && args[0] == "--update" && args[3] == "--test")
        {
            try { HeadroomUpdate.Apply(args[1], int.Parse(args[2])); return 0; }
            catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
        }
        bool updating = args.Length == 3 && args[0] == "--update";
        if (args.Length == 3 && args[0] == "--install-dir" && args[2] == "--test")
        {
            try { Install(args[1], false, delegate { }); return 0; }
            catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
        }
        string selected;
        if (updating) selected = args[1];
        else using (var picker = new FolderBrowserDialog())
        {
            picker.Description = "Selecione a pasta que receberá OpenCode Infinite PT-BR.";
            if (picker.ShowDialog() != DialogResult.OK) return 0;
            selected = picker.SelectedPath;
        }
        int result = 1;
        using (var form = new Form())
        {
            form.Text = "Instalando OpenCode Infinite PT-BR";
            form.ClientSize = new Size(580, 145);
            form.StartPosition = FormStartPosition.CenterScreen;
            form.FormBorderStyle = FormBorderStyle.FixedDialog;
            form.MaximizeBox = false;
            form.MinimizeBox = false;
            var label = new Label { Left = 20, Top = 20, Width = 540, Height = 65, Text = "Instalando arquivos. Aguarde a conclusão; não abra a pasta temporária." };
            form.Controls.Add(label);
            form.Controls.Add(new ProgressBar { Left = 20, Top = 100, Width = 540, Style = ProgressBarStyle.Marquee });
            var worker = new BackgroundWorker { WorkerReportsProgress = true };
            worker.DoWork += delegate(object sender, DoWorkEventArgs work) {
                work.Result = updating ? HeadroomUpdate.Apply(selected, int.Parse(args[2])) : Install(selected, true, delegate(string message) { worker.ReportProgress(0, message); });
            };
            worker.ProgressChanged += delegate(object sender, ProgressChangedEventArgs change) { label.Text = (string)change.UserState; };
            worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs done) {
                if (done.Error != null) MessageBox.Show(form, done.Error.Message, form.Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                else
                {
                    result = 0;
                    string installed = (string)done.Result;
                    Process.Start(new ProcessStartInfo(Path.Combine(installed, "OpenCode Infinite PT-BR.exe")) { WorkingDirectory = installed });
                }
                form.Close();
            };
            form.FormClosing += delegate(object sender, FormClosingEventArgs closing) { if (worker.IsBusy) closing.Cancel = true; };
            form.Shown += delegate { worker.RunWorkerAsync(); };
            Application.Run(form);
        }
        return result;
    }

    private static string Install(string selected, bool shortcuts, Action<string> progress)
    {
            var destination = Path.Combine(Path.GetFullPath(selected), "OpenCode Infinite PT-BR");
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
                progress("Extraindo o aplicativo. Aguarde; os arquivos ainda estão em uma pasta temporária.");
                ZipFile.ExtractToDirectory(payload, staging);
                Directory.Move(staging, destination);
                staging = null;
                progress("Finalizando a instalação e criando os atalhos...");
                var launcher = Path.Combine(destination, "portable", "Registrar atalhos.ps1");
                var shell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
                if (shortcuts)
                {
                    using (var child = Process.Start(new ProcessStartInfo(shell,
                        "-NoProfile -ExecutionPolicy Bypass -File \"" + launcher + "\" -NoLaunch") {
                        UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = destination
                    }))
                    {
                        child.WaitForExit();
                        if (child.ExitCode != 0) throw new IOException("O aplicativo foi instalado, mas não foi possível criar os atalhos. Abra OpenCode Infinite PT-BR.exe na pasta instalada.");
                    }
                }
                return destination;
            }
            finally
            {
                if (payload != null && File.Exists(payload)) File.Delete(payload);
                if (staging != null && Directory.Exists(staging) && Path.GetFullPath(staging).StartsWith(destination + ".", StringComparison.OrdinalIgnoreCase)) Directory.Delete(staging, true);
            }
    }
}
