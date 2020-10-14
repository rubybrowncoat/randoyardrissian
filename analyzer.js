const efes = require('fs')
const { argv } = require('yargs')

const junk = require('junk')
const chalk = require('chalk')

const artefacts = ['#', '_', '*', '>', '<']

const straightQuotes = { 
  '\'': ['‘', '’'], 
  '\"': ['“', '”'],
}

const punctuationOpeners = ['(', '[', '{', '«', '‘', '“']
const punctuationClosers = [')', ']', '}', '»', '’', '”', '!', '?', '.', ',', ';', ':']

const singleMatch = (regexp, content) => {
  const match = regexp.exec(content)

  if (!match) {
    return null
  }

  const actual = match[0]

  return {
    ...match,
    
    actual,
    extent: actual.length,
  }
}

const getMatchPreview = match => {
  const actual = match[0]
  const previewStart = Math.max(match.index - 30, 0)
  const previewEnd = Math.min(previewStart + (actual.length + 60), match.input.length - 1)

  const preview = `${match.input.slice(previewStart, match.index)}${chalk.bold.bgBlue.white(match.input.slice(match.index, match.index + actual.length))}${match.input.slice(match.index + actual.length, previewEnd)}`

  return preview.replace(/\r/g, '').replace(/\n/g, ' ')
}

const program = async () => {
  const paths = argv._

  for (const path of paths) {
    if (!efes.existsSync(path)) {
      console.log(`File: ${path} doesn't exist.`)
      process.exit()
    }
  }

  for (const path of paths) {
    let filenames = [path]
    if (efes.lstatSync(path).isDirectory()) {
      filenames = efes.readdirSync(path).map(file => `${path}${file}`)
    }

    for (const filename of filenames) {
      if (junk.is(filename) || !efes.existsSync(filename)) {
        console.log(filename)
        continue
      }

      const buffer = efes.readFileSync(filename)
      let contents = buffer.toString()

      console.log(chalk.bgGreen(`  ${filename}  `))

      for (const artefact of artefacts) {
        const regexp = new RegExp(`\\${artefact}\+`, 'g')

        let match
        while (match = singleMatch(regexp, contents)) {
          console.log(chalk.bgYellow.black(` ${artefact} ARTEFACT `), getMatchPreview(match))
        }
      }

      for (const quote of Object.keys(straightQuotes)) {
        const regexpOpener = new RegExp(`((\\s|[«\\(\\[\\{}])\\${quote}|\\s\\${quote}«)`, 'g')

        const reported = {}

        let match
        while (match = singleMatch(regexpOpener, contents)) {
          console.log(chalk.bgYellow.black(` ${quote} USED AS OPENER `), getMatchPreview(match), chalk.bgGreen.bold(` REPLACE WITH ${chalk.bgBlueBright(match.actual.replace(quote, straightQuotes[quote][0]))}`))

          reported[match.actual] = reported[match.actual] ? [...reported[match.actual], match.index] : [match.index]
        }
        
        const regexpCloser = new RegExp(`(\\${quote}(\\s|[»!\\?\\.\\,\\]\\);:])|[»!\\?\\.\\,\\]\\);:]\\${quote}\\s)`, 'g')

        while (match = singleMatch(regexpCloser, contents)) {
          console.log(chalk.bgYellow.black(` ${quote} USED AS CLOSER `), getMatchPreview(match), chalk.bgGreen.bold(` REPLACE WITH ${chalk.bgBlueBright(match.actual.replace(quote, straightQuotes[quote][1]))}`))

          reported[match.actual] = reported[match.actual] ? [...reported[match.actual], match.index] : [match.index]
        }

        const regexpWeirdo = new RegExp(`[^A-zÀ-ÖØ-öø-įĴ-őŔ-žǍ-ǰǴ-ǵǸ-țȞ-ȟȤ-ȳɃɆ-ɏḀ-ẞƀ-ƓƗ-ƚƝ-ơƤ-ƥƫ-ưƲ-ƶẠ-ỿ]\\${quote}[^A-zÀ-ÖØ-öø-įĴ-őŔ-žǍ-ǰǴ-ǵǸ-țȞ-ȟȤ-ȳɃɆ-ɏḀ-ẞƀ-ƓƗ-ƚƝ-ơƤ-ƥƫ-ưƲ-ƶẠ-ỿ]`, 'g')

        while (match = singleMatch(regexpWeirdo, contents)) {
          if (reported[match.actual] && reported[match.actual].includes(match.index)) {
            continue
          }

          console.log(chalk.bgYellowBright.black(` ${quote} USED WEIRD? `), getMatchPreview(match))
        }
      }

      for (const opener of punctuationOpeners) {
        const regexp = new RegExp(`\\${opener}\\s`, 'g')

        let match
        while (match = singleMatch(regexp, contents)) {
          console.log(chalk.bgRedBright.black(` BAD ${opener} OPENER `), getMatchPreview(match), chalk.bgGreen.bold(' REMOVE SPACE '))
        }
      }

      for (const closer of punctuationClosers) {
        const regexp = new RegExp(`\\s\\${closer}`, 'g')

        let match
        while (match = singleMatch(regexp, contents)) {
          if (match.actual.includes('.') && match.input.substring(match.index + 1, match.index + 4) === '...') continue

          console.log(chalk.bgRedBright.black(` BAD ${closer} CLOSER `), getMatchPreview(match), chalk.bgGreen.bold(' REMOVE SPACE '))
        }

        for (const opener of punctuationOpeners) {
          const strangeRegexp = new RegExp(`(\\${opener}\\${closer}|\\${closer}\\${opener})`, 'g')

          let match
          while (match = singleMatch(strangeRegexp, contents)) {
            if (match.actual.includes('.') && match.input.substring(match.index + 1, match.index + 4) === '...') continue

            console.log(chalk.bgRedBright.black(` STRANGE ${opener} / ${closer} `), getMatchPreview(match), chalk.bgGreen.bold(' INVERT? '))
          }
        }
      }

      const allPunctuations = [...punctuationOpeners, ...punctuationClosers]
      const allPunctuationsAndStraightQuotes = [...allPunctuations, ...Object.keys(straightQuotes)]
      for (const punctuation of allPunctuations) {
        const regexp = new RegExp(`[^\\s\\${allPunctuations.join('\\')}]\\${punctuation}[^\\s\\${allPunctuations.join('\\')}]`, 'g')

        let match
        while (match = singleMatch(regexp, contents)) {
          if (['.', ',', ':'].includes(punctuation) && match.input[match.index].match(/\d/) && match.input[match.index + 2].match(/\d/)) continue
          if (punctuation === '.' && match.input[match.index + match.extent] === '.') continue
          if (punctuation === '.' && match.input[match.index].match(new RegExp('n', 'i')) && match.input[match.index - 1].match(new RegExp(`[\\s\\${allPunctuationsAndStraightQuotes.join('\\')}]`))) continue
          if (punctuation === '.' && match.input[match.index].match(new RegExp('t', 'i')) && match.input[match.index - 1].match(new RegExp('r', 'i')) && match.input[match.index - 2].match(new RegExp('a', 'i')) && match.input[match.index - 3].match(new RegExp(`[\\s\\${allPunctuationsAndStraightQuotes.join('\\')}]`))) continue
          if (punctuation === '’' && match.input[match.index + match.extent] === '’') continue

          console.log(chalk.bgRedBright.black(` BAD `) + chalk.bgYellow.black(' OR NOT? '), getMatchPreview(match))
        }
      }

      { // BAD ENCLOSURES
        const regexp = new RegExp(`‘(?!(giorno|notte|sera|st(\\w|'\\w)|u|burg|weg|\\d+)[\\s,\\.»\\?:;!\\)\\]])([^’]+)’`, 'gi')
        
        let match
        while (match = singleMatch(regexp, contents)) {
          console.log(chalk.bgRed.black(` BAD ENCLOSURE? `), getMatchPreview(match))
        }
      }

      if (argv.accent) { // FAKE ACCENTS?
        const regexp = new RegExp(`(?<!artel|be|co|da|de|di|du|fa|fe|fra|mo|ne|pe|pie|po|que|se|sta|to|tra|va|ve)[‘’\']\\s`, 'gi')
        
        let match
        while (match = singleMatch(regexp, contents)) {
          console.log(chalk.bgRed.black(` FAKE ACCENT OR USELESS CONTRACTION? `), getMatchPreview(match))
        }
      }
      
      if (argv.weird) { // WEIRDNESS
        {
          const regexp = new RegExp(`((?<!arte)l[’‘]|l'\\s)`, 'gi')
          
          let match
          while (match = singleMatch(regexp, contents)) {
            console.log(chalk.bgRedBright.black(` WEIRDNESS? `), getMatchPreview(match))
          }
        }
        
        {
          const regexp = new RegExp(`[“«\\(\\[\\{\\s](artel|be|co|da|de|di|du|e|fa|fe|fra|mo|ne|pe|pie|po|que|se|sta|to|tra|va|ve)”`, 'gi')
          
          let match
          while (match = singleMatch(regexp, contents)) {
            console.log(chalk.bgRedBright.black(` WEIRDNESS? `), getMatchPreview(match))
          }
        }
      }

      { // GENERIC STATES
        const regexpNoters = new RegExp('(?<![‘\\d+])(?<!\\sn.|\\sart.)(\\d+([\\.-]\\d+)?)+(?<!1\\d\\d\\d)(?<!\\d{2}-\\d{2})(?<!\\d{4}-\\d{2})([\\(\\)\\[\\]\\{\\}«‘“!\\?\\.,;:\\s»])(?!gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|rubli|franchi)(?!\\d+)(Vedi nota \\d+\\.)*', 'g')
        if (singleMatch(regexpNoters, contents)) {
          debugger
          console.log(chalk.bgMagentaBright.black(` CONTAINS POTENTIAL NUMERAL BLOCKERS `))
        }

        const regexpReturns = new RegExp('\\r?\\n(\\r?\\n)+', 'g')
        if (singleMatch(regexpReturns, contents)) {
          debugger
          console.log(chalk.bgCyan.black(` NEEDS RETURN SQUASHING `), chalk.bgGreen.bold(` REPLACE ${chalk.bgBlueBright('\\r?\\n(\\r?\\n)+')} WITH ${chalk.bgBlueBright('\\s')}`))
        }

        const regexpSpacers = new RegExp('\\s\\s+', 'g')
        if (singleMatch(regexpSpacers, contents)) {
          debugger
          console.log(chalk.bgCyanBright.black(` NEEDS SPACER SQUASHING `), chalk.bgGreen.bold(` REPLACE ${chalk.bgBlueBright('\\s\\s+')} WITH ${chalk.bgBlueBright('\\s')}`))
        }
      }

      console.log('')
    }
  }
}

program()