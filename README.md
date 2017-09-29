
# lotus v4.1.0 [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

A simple "task runner" written in CoffeeScript.

```coffee
lotus = require "lotus"

# Run a command provided by a global plugin. 
promise = lotus.run command, options
```

#### Crawling a directory for modules

```coffee
# Resolves with an array of `lotus.Module` instances.
promise = lotus.findModules directory
```

#### Getting a single module

```coffee
mod = lotus.modules.get moduleName

# NEVER DO THIS! Otherwise, the `ModuleCache` will not know about the module.
mod = lotus.Module moduleName
```

