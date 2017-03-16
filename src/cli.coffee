
module.exports = ->

  require "./global"
  require "./index"

  process.exit = do ->
    exit = process.exit.bind process
    return ->
      log.moat 1
      log.onceFlushed exit

  log.indent = 2
  log.moat 1

  minimist = require "minimist"
  options = minimist process.argv.slice 2

  command = options._.join " "
  delete options._

  lotus.run command, options

  .fail (error) ->
    console.log error.stack

  .then process.exit
