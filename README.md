
# lotus v1.0.0 [![experimental](https://img.shields.io/badge/stability-experimental-FF9F2A.svg?style=flat)](https://nodejs.org/api/documentation.html#documentation_stability_index)

- Makes `npm install` unnecessary for local modules in development

- Adds module-specific extensibility to the build process

- Adds CLI extensibility via a global configuration file

- Keeps configuration minimal

- Based on promises instead of streams

- Haste paths for a dedicated module directory (eg: `require('local-module-name')`)

**Please report any issues you come across!** 😇

### Install

Inside your `~/.bashrc`, set `LOTUS_PATH` to the module directory:

```sh
export LOTUS_PATH="/absolute/dir/where/modules/live"
```

To gain access to the `lotus` command:

```
npm i -g aleclarson/lotus#1.0.0
```

To make your own changes to `lotus`:

```
git clone https://github.com/aleclarson/lotus.git

cd lotus

# Install dependencies.
npm install

# Expose the 'lotus' command globally.
npm link
```

### Global configuration

Create a file at `$LOTUS_PATH/lotus-config.coffee`.
This configuration can be used by the `lotus` module (or any of its plugins).

```coffee
module.exports =

  plugins: [
    "lotus-coffee" # Adds the 'lotus coffee' command!
    "lotus-runner" # Adds the 'lotus test' command!
  ]

  # Force 'lotus' to ignore a specific module.
  ignoredModules: [
    "module-template"
  ]
```
