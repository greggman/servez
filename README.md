# Servez

<img src="icon.png" width="128px" />

A simple web server for local web development.

![screenshow](servez.gif)

## Download

[Click Here](https://github.com/greggman/servez/releases/latest)

Choose the `.dmg` for mac or the `.exe` for Windows.

## What?

Servez is an stand alone app that runs a simple web server.
with a GUI to start/stop and choose a folder to serve.

I've worked with many people, often students, who are not
comfortable with command lines and certainly not comfortable
setting up a big server like Apache.

Servez provides them with an easy way to get started without
having to install multiple dependencies nor having to integrate
things with their system. No adding to paths, no downloading
3 different pieces of software. Just run and start.

## Development

### Organization

    main.js          // runs the browser process
    src/index.html   // the main window
    src/index.js     // JS for the main window
    src/style.css    // CSS for the main window
    src/listing.css  // CSS for directory listings

### Running

    npm start

Will launch with devtools open. Setting the environment variable `SERVEZ_ECHO`
to `true` will make issue many logging commands in `main.js` into the log
in the app

### Building

    npm run dist

Will build a file for distribution in the `dist` folder for the current platform.

