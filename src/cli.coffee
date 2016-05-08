
require "./global"

minimist = require "minimist"

process.options = options = minimist process.argv.slice 2

command = options._.shift()

lotus.initialize()

.then ->
  lotus.runCommand command, options

.done()
