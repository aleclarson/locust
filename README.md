
# lotus v1.0.0 [![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

`lotus` is a development framework that provides these helpful features:

  - Minimal task runner

  - Framework-agnostic test runner

  - Keep local dependencies up-to-date automatically

  - Advanced logging utilities

  - Treat your local package directory like 'node_modules' during development

&nbsp;

#### :skull: Under Development :skull:

This framework is still under active development and won't work as expected.

&nbsp;

## Command-Line Interface

The sections below document how to use the `lotus` command-line tool!

```sh
npm install -g aleclarson/lotus#1.0.0
```

&nbsp;

#### Minimal task runner

Watch your `$LOTUS_PATH` package directory and run customizable tasks for watched packages.

```sh
lotus
```

**TIP:** There's no need to `cd` before calling `lotus` because it always uses `$LOTUS_PATH` as the working directory!

Every package directory must contain a `lotus-config` file.

[Learn more about **lotus-config**]().

&nbsp;

#### Framework-agnostic test runner

Even though it's simple to manually run the tests of an individual package...

```sh
lotus test <pkg>
```

... you will probably want to setup your `lotus-config` to allow for efficient & automatic test-running when files change.

```CoffeeScript
module.exports =
  plugins: ["lotus-runner"]
```

When the `lotus` command is used, the package whose `lotus-config` you changed will watch its `js/spec` and `js/src` directories for changes and automatically run the affected tests.

&nbsp;

## JavaScript API

The sections below document how to use `lotus` in your JavaScript applications.

```sh
npm install --save aleclarson/lotus#1.0.0
```

&nbsp;

#### Advanced logging utilities

`lotus` hopes to provide every logging utility you might need while developing your applications.

There are some addons made only for Node (like [**lotus-prompt**]() and [**lotus-repl**]()).

Learn more at [**lotus-log**]().

```CoffeeScript
{ log } = require "lotus"
if log.isVerbose
  log.moat 1
  log.green "Hello", " ", "world"
  log.moat 1
```

&nbsp;

#### Treat your local package directory like 'node_modules' during development

Learn more at [**lotus-require**]().

```CoffeeScript
require "lotus"
merge = require "merge" # Tries to require '$LOTUS_PATH/merge' if it exists.
```

&nbsp;
