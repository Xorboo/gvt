# {{ site.Params.homeInfoParams.Title }}

{{ site.Params.homeInfoParams.Content }}

{{ range site.Params.socialIcons }}- {{ .name }}{{ with .title }} ({{ . }}){{ end }}: {{ .url | absURL }}
{{ end }}
## Talks
{{ partial "talk-list.md" . }}
