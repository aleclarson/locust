
# lotus 3.0.0 ![experimental](https://img.shields.io/badge/stability-experimental-EC5315.svg?style=flat)

An experimental task runner written in CoffeeScript.

### lotus

The `lotus` object contains many utilities for using/managing local modules.

You need `lotus` to manually initialize the specialized environment.

```coffee
lotus = require "lotus"

# Load the global plugins listed in '$LOTUS_PATH/lotus.json'.
# Expose the 'Module', 'File', and 'Plugin' classes.
lotus.initialize().then ->
  #
  # Modules and files can now be created.
  #

  # Run a global command added by a global plugin.
  # Returns a Promise that is resolved when the command throws or finishes.
  # Pass an object as the 2nd argument to specify command-specific options.
  lotus.runCommand "watch", {}

  # Run a global command's method. (eg: lotus foo bar)
  # This is useful for plugins with methods.
  lotus.callMethod "bar",
    command: "foo"
    dir: __dirname + "/methods"
```

### Module

A `Module` is a directory that exists as a child of `lotus.path`. It holds a `package.json` file,
a `src` directory, and an optional `spec` directory.

```coffee
{ Module } = require "lotus"

#
# Globally cache a module named "module-name" that is a child of 'lotus.path'.
#
#   • An existing module will be returned if you use the same arguments multiple times.
#
mod = Module "module-name", lotus.path

#
# Synchronously crawl a directory for its modules.
#
#   • Not recursive! Only direct children are crawled.
#
#   • Typically used by single-pass plugins.
#     To know when modules are added/deleted, you
#     must install "lotus-watch" and use 'Module.watch'!
#
mods = Module.crawl lotus.path

#
# Crawl a module for its compiled source files.
#
#   • Returns a Promise that resolves with the found files.
#
#   • To know when files are added/changed/deleted, you
#     you must install "lotus-watch" and use 'module.watch'!
#
mod.crawl().then (files) ->
  log.format files
```

### File

**TODO:** Write documentation for `File`.

### Plugin

**TODO:** Write documentation for `Plugin`.
