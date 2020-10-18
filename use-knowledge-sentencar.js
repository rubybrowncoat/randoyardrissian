const efes = require('fs')
const msgpack = require('@msgpack/msgpack')

const _sample = require('lodash/sample')

if (!efes.existsSync('./knowledge-sentencar.msp')) {
    console.log('### MAKE KNOWLEDGE SENTENCAR FIRST')
    process.exit()
}

const buffer = efes.readFileSync('./knowledge-sentencar.msp')
const json = msgpack.decode(buffer)

// const json = require('./knowledge-sentencar.json') // PARTIAL JSON

const jsonKeys = Object.keys(json)

const softPunctuation = [',', ':', ';', '_', '(', '[', '«']
const hardPunctuation = ['.', '?', '!', '…']
const punctuation = ['.', ',', ':', ';', '(', ')', '?', '!', '[', ']', '«', '»', '*', '_', '…', '\'']

const DEBUG = process.argv.includes('debug')

const cleanUp = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zA-Z]/g, ' ').replace(/\s+/g, '').trim()

const getLetters = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zA-Z]/g, ' ').trim().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/[a-z]/g, ' ').replace(/\s+/g, '').trim()

const checkParity = (expression) => {
  const holder = []
  const specialBrackets = ['"']
  const openBrackets = ['(', '{', '[', '«', '“']
  const closedBrackets = [')', '}', ']', '»', '”']

  for (let [index, letter] of expression.split('').entries()) {
    if (openBrackets.includes(letter)) {
      holder.push([index, letter])
    } else if (closedBrackets.includes(letter)) {
      const openPair = openBrackets[closedBrackets.indexOf(letter)]

      if (!holder.length) {
        holder.push([index, letter])
        return holder
      }

      const [, lastLetter] = holder[holder.length - 1]

      if (lastLetter === openPair) {
        holder.splice(-1, 1)
      } else {
        if (!holder.find(([, heldLetter]) => heldLetter === openPair)) {
          console.log('AAA?', openPair, letter)
          holder.push([index, letter])
        }

        return holder
      }
    }

    if (specialBrackets.includes(letter)) {
      if (holder.find(([, heldLetter]) => heldLetter === letter)) {
        const [, lastLetter] = holder[holder.length - 1]

        if (!lastLetter === letter) {
          holder.splice(-1, 1)
        } else {
          holder.push([index, letter])
          return holder
        }
      } else {
        holder.push([index, letter])
      }
    }
  }

  if (holder.length) {
    return holder
  }

  return true
}

const makeFrom = (letters = [], sentence = '') => {
  const mainPotentials = []
  const subPotentials = []

  if (!letters.length) {
    let trimmed = sentence.trim()

    const lastCharacter = trimmed.slice(-1)
    if (softPunctuation.includes(lastCharacter)) {
      trimmed = trimmed.replace(/.$/, _sample(hardPunctuation))
    } else if (!punctuation.includes(lastCharacter)) {
      trimmed += _sample(hardPunctuation)
    }

    return trimmed
  }

  let letterSets = []
  if (!letterSets.length) {
    for (let offset = 0; offset < letters.length; offset += 1) {
      letterSets.push(offset ? letters.slice(0, -offset) : letters)
    }
  }

  if (DEBUG) console.log('letterSets', letterSets.map(set => set.join('')).join(', '))

  letterSets.forEach(set => {
    const letterString = set.join('')

    const jsonGroup = json[letterString]
    if (jsonGroup) {
      jsonGroup.forEach(match => mainPotentials.push([letterString, match]))
    } else {
      const testGroups = jsonKeys.reduce((aggregate, key) => {
        if (key.includes(letterString)) {
          aggregate.push([key, json[key]]) 
        }

        return aggregate
      }, [])

      testGroups.forEach(([letters, group]) => group.forEach((item) => {
        const spaceGroups = item.split(/\s+/)

        for (let iterator = 0; iterator < letters.length - letterString.length; iterator += 1) {
          const sliceGroup = spaceGroups.slice(iterator, iterator + letterString.length)
          const sliceMatch = sliceGroup.join(' ')
          const sliceLetters = getLetters(sliceGroup.join(' '))
          
          if (sliceLetters.length === letterString.length && sliceLetters === letterString) {
            subPotentials.push([letterString, sliceMatch])
          }
        }
      }))
    }
  })

  // Potential Selection
  const potentialSets = [mainPotentials, subPotentials]

  let selectedLetters
  let remainingLetters
  let selection

  let reduction = 1
  let potentials = potentialSets.shift()
  do {
    if (potentials.length) {
      const sampledPotential = _sample(potentials)

      selectedLetters = sampledPotential[0]
      remainingLetters = letters.slice(selectedLetters.length)

      selection = sampledPotential[1]
    } else {
      reduction += 1

      if (!potentialSets.length) {
        selection = 'N/A'
      }

      potentials = potentialSets.shift()

      if (!potentialSets.length) {
        if (DEBUG) console.log('EMPTY POTENTIAL')

        // FORCE CLOSE SENTENCE UPON REACHING GLOBAL POTENTIALS? MEH
        // if (sentence.length && !punctuation.includes(sentence.slice(-1))) {
        //   sentence += '.'
        // }
      }
    }
  } while (!selection.length)

  if (DEBUG) console.log(selectedLetters, selection, !!mainPotentials.length, !!subPotentials.length)

  // SPECIFIC ELEMENT CHANGES
  if (!remainingLetters.length) {
    const endCap = selection.split('').slice(-1)

    if (endCap === 'e') {
      selection += '...'
    }
  }

  sentence += ` ${selection}`

  return makeFrom(remainingLetters, sentence)
}

const program = async () => {
  for (let times = 0; times < 10; times += 1) {
    const sampleKey = _sample(jsonKeys)
    const sampleGroup = _sample(json[sampleKey])

    // const word = cleanUp(_sample(sampleGroup.split(/\s+/))).toUpperCase()
    const word = 'VRSETALT'

    if (word.length > 1) {
      const starter = makeFrom(word.split(''))

      // CLEAN UP UNPAIRED ELEMENTS
      let sentence = starter
      for (let parityResult = checkParity(sentence); Array.isArray(parityResult) && !!parityResult.length;) {
        progress = true
        const [culpritIndex, ] = parityResult.pop()

        const split = sentence.split('')
        split.splice(culpritIndex, 1)

        sentence = split.join('')

        parityResult = checkParity(sentence)
      }

      console.log(word)

      if (DEBUG) console.log(starter)

      console.log(sentence)

      // { // GOOGLE SYNTAX ANALYSIS
      //   const language = require('@google-cloud/language')
      //   const client = new language.LanguageServiceClient()

      //   const document = {
      //     content: sentence,
      //     language: 'it',
      //     type: 'PLAIN_TEXT',
      //   }
      //   const encodingType = 'UTF8'

      //   const response = await client.analyzeSyntax({
      //     document, 
      //     encodingType,
      //   })
        
      //   const syntax = response[0]
        
      //   console.log('Tokens:');
      //   syntax.tokens.forEach(part => {
      //     console.log(`${part.partOfSpeech.tag}: ${part.text.content}`);
      //     console.log('Morphology:', part.partOfSpeech);
      //   })

      //   efes.writeFileSync('./google-language-response', JSON.stringify(response, null, 2))
      // }

      console.log('')
    }
  }
}

program()

