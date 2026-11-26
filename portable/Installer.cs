using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Windows.Forms;

internal static class Installer
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        if (args.Length == 3 && args[0] == "--update")
        {
            try { UpdateExisting(args[1], int.Parse(args[2])); }
            catch (Exception error) { MessageBox.Show(error.Message, "OpenCode Infinite PT-BR"); }
            return;
        }
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
                Extract(payload, staging);
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

    private static void Extract(string payload, string staging)
    {
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
    }

    private static void UpdateExisting(string destination, int processId)
    {
        destination = Path.GetFullPath(destination);
        var launcher = Path.Combine(destination, "Abrir OpenCode.ps1");
        var apps = Path.Combine(destination, "apps", "OpenCode");
        if (!File.Exists(launcher) || !File.Exists(Path.Combine(apps, "OpenCode.exe")))
            throw new IOException("Instalação portátil não localizada.");
        var staging = Path.Combine(destination, ".update-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        var payload = Path.Combine(staging, "payload.zip");
        var extracted = Path.Combine(staging, "new");
        Directory.CreateDirectory(extracted);
        var previousApp = Path.Combine(staging, "previous-app");
        var previousLauncher = Path.Combine(staging, "previous-launcher.ps1");
        bool appMoved = false, newAppMoved = false, launcherReplaced = false, preserveBackup = false;
        try
        {
            Extract(payload, extracted);
            try
            {
                using (var running = Process.GetProcessById(processId))
                    if (!running.WaitForExit(30000)) throw new IOException("Feche o OpenCode e tente novamente.");
            }
            catch (ArgumentException) { }
            var newApps = Path.Combine(extracted, "apps", "OpenCode");
            if (!File.Exists(Path.Combine(newApps, "OpenCode.exe"))) throw new IOException("Instalador incompleto.");
            for (var attempt = 0; ; attempt++)
            {
                try { Directory.Move(apps, previousApp); break; }
                catch (IOException) { if (attempt >= 20) throw; System.Threading.Thread.Sleep(250); }
            }
            appMoved = true;
            Directory.Move(newApps, apps);
            newAppMoved = true;
            File.Replace(Path.Combine(extracted, "Abrir OpenCode.ps1"), launcher, previousLauncher);
            launcherReplaced = true;
            Launch(destination, launcher);
        }
        catch
        {
            preserveBackup = appMoved;
            if (launcherReplaced) File.Replace(previousLauncher, launcher, null);
            if (newAppMoved) Directory.Move(apps, Path.Combine(staging, "failed-app"));
            if (appMoved) Directory.Move(previousApp, apps);
            preserveBackup = false;
            throw;
        }
        finally
        {
            if (!preserveBackup)
                try { Directory.Delete(staging, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }

    private static void Launch(string destination, string launcher)
    {
        var shell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
        Process.Start(new ProcessStartInfo(shell,
            "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + launcher + "\"") {
            UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = destination
        });
    }
}
