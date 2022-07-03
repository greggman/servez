# Servez

<img src="servez.jpg" width="512px" />

A simple web server for local web development.

![screenshow](servez.gif)

## Download

[Click Here](https://github.com/greggman/servez/releases/latest)

Choose the `.dmg` for mac, the `.exe` for Windows, or the `.AppImage` for Linux.

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

## HTTPS

Servez has an option to serve HTTPS. Servez
uses a self signed certificate which means your browser will complain
that the certificate is not valid. You can click "advanced" on the warning
page and then "Proceed to &lt;localhost&gt;" to load the page.

The point of HTTPS support in Servez is to make it easy to access HTTPS only APIs
like WebXR etc... Clicking through a warning once in a while is a small tradeoff for
automating HTTPS support.

## Command Line Arguments

If you want an actual command line version then [go here](https://github.com/greggman/servez-cli).

Otherwise these are the command line arguments to this app version
of Servez.

**NOTE! You must include an extra `--` *by itself* before your arguments**

```
servez.exe --port=1234 c:\path\to\serve      # BAD!
servez.exe -- --port=1234 c:\path\to\serve   # good
```

On Windows the default path is

```
c:\Users\<username>\AppData\Local\Programs\Servez\Servez.exe
```

on MacOS the default path is

```
/Applications/Servez.app/Contents/MacOS/Servez
```

### Usage

```
servez [options] path/to/serve
```

* `--help` prints the command line arguments

* `-p` or `--port` sets the port as in `--port=1234`

* `-S` or `--ssl` use HTTPS (see above)

* `--no-dirs` don't show directory listings for folders

* `--no-cors` don't supply CORS headers

* `--local` only allow access from local machine

* `--no-index` don't serve index.html for folders

## Development

### Setup

*   Install node.js

    You can [download it here](https://nodejs.org).

*   clone this repo

        git clone https://github.com/greggman/servez.git

*   change to the project's folder

        cd servez

*   install dependencies

        npm install

### Organization

    main.js          // runs the browser process
    src/index.html   // the main window
    src/index.js     // JS for the main window
    src/style.css    // CSS for the main window

### Running

    npm start

Will launch with devtools open. Setting the environment variable `SERVEZ_ECHO`
to `true` will make issue many logging commands in `main.js` into the log
in the app

### Building

    npm run dist

Will build a file for distribution in the `dist` folder for the current platform.
Note: On MacOS you'll need an Apple Developer account. Then build like this

```bash
APPLEID=<your-apple-id> APPLEIDPASS=<see-below-password> npm run dist
```

For `<your-apple-id>` instead your Apple ID. Example `APPLEID=myaccount@gmail.com` or whatever your
Apple ID is.

For `<see-below-password>` the first step is go to [https://appleid.apple.com/](https://appleid.apple.com/)
and generate an *app specific password*. Then, add that password to your keychain with an id of your choosing.

```
security add-generic-password -a "<your-apple-id>" -w <app-specific-password> -s "<key-id>"
```

Example:

```
security add-generic-password -a "myaccount@gmail.com" -w thea-pppa-sswo-rddd -s "foobar"
```

From then on, to build

```
APPLEID=myaccount@gmail.com APPLEIDPASS=@keychain:foobar npm run dist
```

During the build it will ask you to give it access to 'foobar'
