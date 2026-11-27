$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$speechType = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$streamType = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$readerType = [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Wait-VoiceOperation($Operation, [type]$ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.GetAwaiter().GetResult()
}
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()))
if ([string]::IsNullOrWhiteSpace($text) -or $text.Length -gt 1600) { exit 1 }
$voice = $speechType::AllVoices | Where-Object Language -eq 'pt-BR' | Select-Object -First 1
if (!$voice) { exit 1 }
$synth = New-Object $speechType
try {
    $synth.Voice = $voice
    $stream = Wait-VoiceOperation ($synth.SynthesizeTextToStreamAsync($text)) $streamType
    try {
        if (!$stream.Size -or $stream.Size -gt 6291456) { exit 1 }
        $reader = New-Object $readerType ($stream.GetInputStreamAt(0))
        try {
            [void](Wait-VoiceOperation ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]))
            $bytes = New-Object byte[] ([int]$stream.Size)
            $reader.ReadBytes($bytes)
            [Console]::Write([Convert]::ToBase64String($bytes))
        } finally { $reader.Dispose() }
    } finally { $stream.Dispose() }
} finally { $synth.Dispose() }
