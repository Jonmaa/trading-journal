# Trading Diary

Diario de trading personal en un único archivo HTML, sin backend ni proceso de build.

## Descripción

Trading Diary es una aplicación web de una sola página para registrar tus operaciones de trading, consultar estadísticas de rendimiento y ver tus resultados en un calendario mensual. No requiere servidor ni instalación: todos los datos se guardan en el `localStorage` del navegador, así que nada sale de tu equipo.

## Características

- **Registro de operaciones**: fecha, símbolo, dirección (long/short), patrón/setup, precio de entrada, stop, salida, P&L y notas de gestión/emociones.
- **Capturas de gráfico**: sube una imagen o pégala directamente con `Ctrl+V` / `⌘V` (por ejemplo, copiada desde TradingView con el icono de cámara → "Copiar imagen").
- **Estadísticas de rendimiento**: capital inicial y actual, rentabilidad YTD y mensual, win rate, racha actual, desglose mensual y curva de equidad — todo visible en $ o en múltiplos R.
- **Calendario de resultados**: vista mensual con el resultado de cada día y un resumen semanal, también en $ o en R.
- **Idioma ES/EN**: botón en la cabecera para cambiar el idioma de la interfaz, que además adapta el formato numérico (1.234,56 vs 1,234.56) y de fecha (dd/mm/aa vs mm/dd/aa).
- **Exportar / Importar**: backup completo del historial en un archivo JSON.

## Uso

1. Descarga o clona este repositorio.
2. Abre `journalfinal.html` directamente en tu navegador (doble clic, o `open journalfinal.html` / `start journalfinal.html`).
3. Empieza a registrar tus operaciones. Usa el botón **Exportar** de vez en cuando para guardar una copia de seguridad de tus datos.

No hace falta instalar dependencias ni levantar ningún servidor.

## Estructura del proyecto

Todo el proyecto vive en un único archivo:

```
journalfinal.html   → HTML + CSS + JavaScript de toda la aplicación
```

Las únicas dependencias externas son las tipografías (Manrope e IBM Plex Mono) cargadas desde Google Fonts.

## Datos y privacidad

Las operaciones, el capital inicial, el idioma elegido y las capturas de gráfico se guardan exclusivamente en el `localStorage` de tu navegador. La aplicación no envía ningún dato a servidores externos. Al limpiar los datos del navegador (o cambiar de navegador/equipo) se pierde el historial guardado, por lo que se recomienda exportar backups periódicamente.
