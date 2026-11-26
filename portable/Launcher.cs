using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Launcher
{
    internal static string Quote(string value)
    {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value)
        {
            if (c == '\\') { slashes++; continue; }
            result.Append('\\', c == '"' ? slashes * 2 + 1 : slashes);
            result.Append(c);
            slashes = 0;
        }
        result.Append('\\', slashes * 2);
        return result.Append('"').ToString();
    }

    [STAThread]
    private static int Main(string[] args)
    {
        AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
        AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        Application.EnableVisualStyles();
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        string script = Path.Combine(root, "portable", "Launch-WithHeadroom.ps1");
        if (!File.Exists(script))
        {
            MessageBox.Show("portable\\Launch-WithHeadroom.ps1 não foi encontrado. Reinstale o pacote com Headroom.", "OpenCode Infinite PT-BR");
            return 1;
        }
        using (var form = new Form())
        {
            form.Text = "OpenCode Infinite PT-BR";
            form.ClientSize = new Size(560, 150);
            form.StartPosition = FormStartPosition.CenterScreen;
            form.FormBorderStyle = FormBorderStyle.FixedDialog;
            form.MaximizeBox = false;
            form.MinimizeBox = false;
            var label = new Label { Left = 20, Top = 20, Width = 520, Height = 65,
                Text = "Iniciando OpenCode...\r\nNa primeira abertura, o Headroom pode precisar baixar e instalar dependências. Aguarde." };
            form.Controls.Add(label);
            form.Controls.Add(new ProgressBar { Left = 20, Top = 100, Width = 520, Style = ProgressBarStyle.Marquee });
            var worker = new BackgroundWorker { WorkerReportsProgress = true };
            var log = new StringBuilder();
            object gate = new object();
            int exitCode = 1;
            worker.DoWork += delegate
            {
                string shell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
                string arguments = "-NoProfile -ExecutionPolicy Bypass -File " + Quote(script);
                foreach (string arg in args) arguments += " " + Quote(arg);
                using (var process = new Process())
                {
                    process.StartInfo = new ProcessStartInfo(shell, arguments) {
                        WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                        RedirectStandardOutput = true, RedirectStandardError = true
                    };
                    DataReceivedEventHandler received = delegate(object sender, DataReceivedEventArgs line)
                    {
                        if (line.Data == null) return;
                        lock (gate) { if (log.Length < 256000) log.AppendLine(line.Data); }
                    };
                    process.OutputDataReceived += received;
                    process.ErrorDataReceived += received;
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    // The unbounded overload also waits for redirected pipe EOF.
                    // A background child can retain an inherited handle after
                    // PowerShell exits, keeping the progress window open forever.
                    while (!process.WaitForExit(250)) { }
                    exitCode = process.ExitCode;
                }
                string folder = Path.Combine(root, "profile");
                Directory.CreateDirectory(folder);
                lock (gate) File.WriteAllText(Path.Combine(folder, "launcher.log"), log.ToString(), Encoding.UTF8);
            };
            worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs done)
            {
                if (done.Error != null || exitCode != 0)
                {
                    string error = done.Error != null ? done.Error.Message : "Consulte profile\\launcher.log para os detalhes.";
                    MessageBox.Show(form, "Não foi possível iniciar o OpenCode.\r\n" + error, form.Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                form.Close();
            };
            form.FormClosing += delegate(object sender, FormClosingEventArgs closing) { if (worker.IsBusy) closing.Cancel = true; };
            form.Shown += delegate { worker.RunWorkerAsync(); };
            Application.Run(form);
            return exitCode;
        }
    }
}
