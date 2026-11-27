using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.ComponentModel;
using System.Drawing;
using System.Security.Cryptography;
using System.Windows.Forms;

internal static class Installer
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        if (args.Length == 5 && args[0] == "--apply-zip")
        {
            var destination = Path.GetFullPath(args[1]);
            var package = Path.GetFullPath(args[3]);
            try { UpdateExisting(destination, int.Parse(args[2]), package, args[4]); }
            catch (Exception error)
            {
                Environment.ExitCode = 1;
                File.AppendAllText(Path.Combine(destination, ".updates", "install.log"), error.Message + Environment.NewLine);
            }
            return;
        }
        if (args.Length == 3 && args[0] == "--update")
        {
            try { UpdateExisting(args[1], int.Parse(args[2])); }
            catch (Exception error) { Environment.ExitCode = 1; MessageBox.Show(error.Message, "OpenCode Infinite PT-BR"); }
            return;
        }
        using (var picker = new FolderBrowserDialog())
        {
            picker.Description = "Selecione a pasta que receberá OpenCode Infinite PT-BR.";
            if (picker.ShowDialog() != DialogResult.OK) return;
            Install(Path.Combine(picker.SelectedPath, "OpenCode Infinite PT-BR"));
        }
    }

    private static void Install(string destination)
    {
        using (var progress = new Form { Text = "Instalando OpenCode Infinite PT-BR", StartPosition = FormStartPosition.CenterScreen,
            ClientSize = new Size(420, 90), FormBorderStyle = FormBorderStyle.FixedDialog, ControlBox = false })
        using (var worker = new BackgroundWorker())
        {
            progress.Controls.Add(new Label { Text = "Instalando… O OpenCode abrirá ao terminar.", AutoSize = true,
                Location = new Point(16, 18) });
            progress.Controls.Add(new ProgressBar { Style = ProgressBarStyle.Marquee,
                Location = new Point(16, 48), Size = new Size(388, 18) });
            worker.DoWork += (sender, args) => InstallFiles(destination);
            worker.RunWorkerCompleted += (sender, args) => {
                if (args.Error != null) MessageBox.Show(progress, args.Error.Message, "OpenCode Infinite PT-BR");
                progress.Close();
            };
            progress.Shown += (sender, args) => worker.RunWorkerAsync();
            Application.Run(progress);
        }
    }

    private static void InstallFiles(string destination)
    {
        destination = Path.GetFullPath(destination);
        if (Directory.Exists(destination) || File.Exists(destination))
            throw new IOException("Já existe um OpenCode nessa pasta. Use Verificar atualizações no aplicativo ou escolha outro local.");
        var staging = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        var payload = staging + ".zip";
        try
        {
            Directory.CreateDirectory(staging);
            Extract(payload, staging);
            var register = Path.Combine(staging, "portable", "Registrar atalhos.ps1");
            if (!File.Exists(register) || !File.Exists(Path.Combine(staging, "apps", "OpenCode", "OpenCode.exe")))
                throw new IOException("Instalador incompleto.");
            Directory.Move(staging, destination);
            Launch(destination, Path.Combine(destination, "portable", "Registrar atalhos.ps1"));
        }
        finally
        {
            if (File.Exists(payload)) File.Delete(payload);
            if (Directory.Exists(staging)) Directory.Delete(staging, true);
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

    private static void UpdateExisting(string destination, int processId, string package = null, string expectedHash = null)
    {
        destination = Path.GetFullPath(destination);
        var launcher = Path.Combine(destination, "Abrir OpenCode.ps1");
        var apps = Path.Combine(destination, "apps", "OpenCode");
        if (!File.Exists(launcher) || !File.Exists(Path.Combine(apps, "OpenCode.exe")))
            throw new IOException("Instalação portátil não localizada.");
        var staging = package == null ? Path.Combine(destination, ".update-" + Guid.NewGuid().ToString("N"))
            : Path.GetDirectoryName(package);
        if (package != null &&
            (!string.Equals(Path.GetDirectoryName(staging), Path.Combine(destination, ".updates"), StringComparison.OrdinalIgnoreCase) ||
             !Path.GetFileName(staging).StartsWith("download-", StringComparison.Ordinal) ||
             !string.Equals(Path.GetFileName(package), "payload.zip", StringComparison.OrdinalIgnoreCase)))
            throw new IOException("Pacote fora da pasta de atualização.");
        foreach (var directory in new[] {destination, apps, staging})
            if (Directory.Exists(directory) && (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("A atualização encontrou uma pasta redirecionada.");
        Directory.CreateDirectory(staging);
        var extracted = Path.Combine(staging, "new");
        Directory.CreateDirectory(extracted);
        var previousApp = Path.Combine(staging, "previous-app");
        var previousLauncher = Path.Combine(staging, "previous-launcher.ps1");
        bool appMoved = false, newAppMoved = false, launcherReplaced = false, preserveBackup = false;
        try
        {
            if (package == null) Extract(Path.Combine(staging, "payload.zip"), extracted);
            else
            {
                using (var file = File.OpenRead(package))
                using (var hash = SHA256.Create())
                {
                    var actual = BitConverter.ToString(hash.ComputeHash(file)).Replace("-", "");
                    if (!string.Equals(expectedHash, actual, StringComparison.OrdinalIgnoreCase))
                        throw new IOException("A integridade do pacote não confere.");
                }
                ZipFile.ExtractToDirectory(package, extracted);
            }
            var newApps = Path.Combine(extracted, "apps", "OpenCode");
            if (!File.Exists(Path.Combine(newApps, "OpenCode.exe")) ||
                !File.Exists(Path.Combine(newApps, "resources", "app.asar")) ||
                !File.Exists(Path.Combine(newApps, "resources", "portable", "update-worker.exe")) ||
                !File.Exists(Path.Combine(extracted, "Abrir OpenCode.ps1"))) throw new IOException("Instalador incompleto.");
            if (package != null) File.WriteAllText(Path.Combine(staging, "ready"), "ready");
            try
            {
                using (var running = Process.GetProcessById(processId))
                    if (!running.WaitForExit(30000)) throw new IOException("Feche o OpenCode e tente novamente.");
            }
            catch (ArgumentException) { }
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
            try {
                using (var running = Process.GetProcessById(processId))
                    if (running.HasExited) Launch(destination, launcher);
            }
            catch (ArgumentException) { Launch(destination, launcher); }
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
