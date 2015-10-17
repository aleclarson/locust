
# lotus v1.0.0 [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

`lotus` is a toolset for enhancing the CoffeeScript development process.

It acts as an umbrella for these modules:

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-cli**](https://github.com/aleclarson/lotus/tree/master/docs/cli.md)

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-log**](https://github.com/aleclarson/lotus-log)

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-require**](https://github.com/aleclarson/lotus-require)

&nbsp;

## getting started

This guide should be enough to get you going with `lotus`. If you have any questions, feel free to [submit an issue](https://github.com/aleclarson/lotus/issues). I'll try to help as soon as I can.

&nbsp;

### 0. Install `lotus`

```sh
npm install -g aleclarson/lotus#1.0.0
```

&nbsp;

### 1. Setup environment variables

Environment variables for configuring `lotus` include:

```sh
export LOTUS="true"
```

The **LOTUS** environment variable specifies if `lotus` should be used. If not set, `lotus` is not used.

```sh
export LOTUS_PATH="$HOME/modules"
```

The **LOTUS_PATH** environment variable specifies where to look for your locally installed modules.

If you're on OSX, put these in your `.bashrc` or `.bash_profile`.

&nbsp;

### 2. Setup your local modules

In order for `lotus` to find your modules, they must each contain a `lotus-config.coffee` file that specifies which plugins to use (plus any additional plugin configuration).

This is what a typical `lotus-config.coffee` file will look like:

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
```

As you can see, more setup and/or configuration may be required depending on the plugins your module uses. Be sure to read each plugin's documentation thoroughly.

&nbsp;

### 3. Require `lotus` in your modules

```CoffeeScript
require "lotus"
```

This will modify the `Module` class from Node's core. In doing so, any modules in the `$LOTUS_PATH` directory will be preferred when calling `require "some-module"` as you would normally do.

For example, let's say the paths `$LOTUS_PATH/some-module` and `my-project/node_modules/some-module` both exist. Then you call `require "some-module"` from a source file in `my-project/src`. If `$LOTUS` equals `"true"`, the first path will be used. Otherwise, the second path will be used.

&nbsp;

### 4. Run the `lotus` command in your terminal

```sh
lotus
```

Running this command will find every valid module in `$LOTUS_PATH`. During this process, each module's `lotus-config.coffee` file is used to initialize any specified plugins. Once all modules are fully initialized, `lotus` leaves it up to the plugins to do the rest.

&nbsp;

### 5. Find suitable plugins.

Currently available plugins include:

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-coffee**](https://github.com/aleclarson/lotus-coffee)

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-runner**](https://github.com/aleclarson/lotus-runner)

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-jasmine**](https://github.com/aleclarson/lotus-jasmine)

#### &nbsp;&nbsp;&nbsp;&nbsp;- [**lotus-lab**](https://github.com/aleclarson/lotus-lab)

Please send a pull request if you make a plugin! :+1:

&nbsp;
