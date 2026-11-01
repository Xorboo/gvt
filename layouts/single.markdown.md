# {{ partial "full-title.html" . }}
{{ with .Params.speaker }}
- Speaker: {{ . }}
- Date: {{ $.Date.Format "2006-01-02" }}{{ end }}{{ with .Params.youtube }}
- Recording: {{ . }}{{ end }}
{{ with .Description }}
## Description

{{ . }}
{{ end }}{{ with .Params.speakerInfo }}
## About the speaker

{{ . }}
{{ end }}{{ .RawContent }}
