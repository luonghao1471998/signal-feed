<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#ffffff">
    <title>{{ config('app.name', 'SignalFeed') }}</title>
    @viteReactRefresh
    @vite(['src/main.tsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
