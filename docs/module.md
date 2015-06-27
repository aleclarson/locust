
# lotus/module

```CoffeeScript
Module = require "lotus/module"
```

&nbsp;

A `Module` represents a directory that:

- is a direct child of `process.env.LOTUS_PATH`

- has a `lotus-config.coffee` file

- has a `src` directory

**Note:** Nested source files aren't yet supported (eg: `src/foo/bar.coffee`).

&nbsp;

#### tests

A `Module` can optionally have a `spec` directory.

Just like your `src` files, your `spec` files are found in `module.files`.

&nbsp;

#### lotus-config.coffee

```CoffeeScript
module.exports =
  
  plugins:
    coffee: "lotus-coffee"
    runner: "lotus-runner"

  coffee:
    bare: yes
    sourceMap: yes

  runner:
    suite: "lotus-jasmine"
    reporter: "lotus-jasmine/reporter"
    extensions: "coffee"

```

&nbsp;

## public api

### module.name

*Nothing here.*

&nbsp;

### module.path

*Nothing here.*

&nbsp;

### module.files

*Nothing here.*

&nbsp;

### module.initialize()

*Nothing here.*

&nbsp;

## internal api

### module._watchFiles(options)

Initializes and watches the files that match a specific pattern.

Returns a `Promise` that is resolved after all initialization is completed.

#### options:

- **pattern:** The [minimatch]() pattern to match files against

- **onReady:** Called when all files have been found during initialization

- **onCreate:** Called when a file has been created

- **onChange:** Called when a file has been edited

- **onSave:** Called when a file is either created or edited

- **onDelete:** Called when a file has been deleted

- **onEvent:** Called when any file event occurs

&nbsp;

## example

*Nothing here.*

&nbsp;
