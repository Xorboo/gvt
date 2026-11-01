{{- range where site.RegularPages "Section" "talks" }}
- [{{ partial "full-title.html" . }}]({{ .Permalink }}) - {{ .Params.speaker }}, {{ .Date.Format "2006-01-02" }}{{ with .Params.youtube }} ([recording]({{ . }})){{ end }}
{{- end }}
