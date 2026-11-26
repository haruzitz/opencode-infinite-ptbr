using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Windows.Forms;

// Match the official updater's replacement contract: apps + official launcher.
// Keep the profile, native local launcher and portable Headroom layer intact.
internal static class HeadroomUpdate
{
    internal static string Apply(string destination, int processId)
    {
        destination = Path.GetFullPath(destination);
        string launcher = Path.Combine(destination, "Abrir OpenCode.ps1");
        string apps = Path.Combine(destination, "apps", "OpenCode");
        if (!File.Exists(launcher) || !File.Exists(Path.Combine(apps, "OpenCode.exe")))
            throw new IOException("Instalação portátil não localizada.");
        string staging = Path.Combine(destination, ".update-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        string payload = Path.Combine(staging, "payload.zip");
        string extracted = Path.Combine(staging, "new");
        string previousApp = Path.Combine(staging, "previous-app");
        string previousLauncher = Path.Combine(staging, "previous-launcher.ps1");
        bool appMoved = false, newAppMoved = false, launcherReplaced = false, preserveBackup = false;
        try
        {
            using (var executable = File.OpenRead(Application.ExecutablePath))
            using (var reader = new BinaryReader(executable))
            using (var archive = File.Create(payload))
            {
                executable.Seek(-8, SeekOrigin.End);
                long start = reader.ReadInt64();
                if (start <= 0 || start >= executable.Length - 8) throw new IOException("Instalador incompleto.");
                executable.Position = start;
                byte[] buffer = new byte[1024 * 1024];
                long remaining = executable.Length - 8 - start;
                while (remaining > 0)
                {
                    int count = executable.Read(buffer, 0, (int)Math.Min(remaining, buffer.Length));
                    if (count == 0) throw new EndOfStreamException();
                    archive.Write(buffer, 0, count);
                    remaining -= count;
                }
            }
            ZipFile.ExtractToDirectory(payload, extracted);
            if (processId > 0)
            {
                try
                {
                    using (var running = Process.GetProcessById(processId))
                        if (!running.WaitForExit(30000)) throw new IOException("Feche o OpenCode e tente novamente.");
                }
                catch (ArgumentException) { }
            }
            string newApps = Path.Combine(extracted, "apps", "OpenCode");
            if (!File.Exists(Path.Combine(newApps, "OpenCode.exe"))) throw new IOException("Instalador incompleto.");
            for (int attempt = 0; ; attempt++)
            {
                try { Directory.Move(apps, previousApp); break; }
                catch (IOException) { if (attempt >= 20) throw; System.Threading.Thread.Sleep(250); }
            }
            appMoved = true;
            Directory.Move(newApps, apps);
            newAppMoved = true;
            File.Replace(Path.Combine(extracted, "Abrir OpenCode.ps1"), launcher, previousLauncher);
            launcherReplaced = true;
            return destination;
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
            if (!preserveBackup && Path.GetDirectoryName(staging) == destination)
                try { Directory.Delete(staging, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}
