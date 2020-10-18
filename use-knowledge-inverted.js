const efes = require('fs')
const msgpack = require('@msgpack/msgpack')

const _sample = require('lodash/sample')
const _without = require('lodash/without')
const { reverse } = require('lodash')

if (!efes.existsSync('./knowledge.msp')) {
    console.log('### MAKE KNOWLEDGE FIRST')
    process.exit()
}

const buffer = efes.readFileSync('./knowledge.msp')
const json = msgpack.decode(buffer)

// const json = require('./knowledge.json') // PARTIAL JSON

const softPunctuation = [',', ':', ';', '_', '(', '[', '«']
const hardPunctuation = ['.', '?', '!', '…']
const punctuation = ['.', ',', ':', ';', '(', ')', '?', '!', '[', ']', '«', '»', '*', '_', '…', '\'']

const vocals = ['a', 'e', 'i', 'o', 'u']

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

const getGroupItems = (group, previousLetter, nextLetter, reduction) => Object.entries(group).reduce((whole, [element, quantity]) => {
  const clean = cleanUp(element)
  const cleanLength = clean.length

  // if (!nextLetter && ['a', 'con', 'per', 'tra', 'fra', 'dalla', 'della', 'dello', 'degli', 'delle', 'dalle', 'il', 'lo', 'la', 'le', 'i', 'gli'].includes(clean)) { // UNSURE WHAT I WAS GOING FOR HERE
  //   console.log('EEE', element)
  //   // whole.push()

  //   // return whole
  // }

  if (!nextLetter) {
    if (['il', 'lo', 'gli', 'con'].includes(clean)) {
      if (element.slice(-3) !== '...') {
        if (DEBUG) console.log('SKIPPED END', element)

        return whole
      }
    }
  }

  if (cleanLength === 1) {
    if (!nextLetter) {
      if (!clean !== 'e' && element.slice(-3) !== '...' ) {
        if (DEBUG) console.log('SKIPPED L1', element)

        return whole
      }
    }

    if (reduction === 3) {
      if (DEBUG) console.log('SKIPPED R3', element)

      return whole
    }

    if (punctuation.includes(previousLetter)) {
      if (DEBUG) console.log('SKIPPED AP', element)

      return whole
    }
  }

  if (cleanLength === 2) {
    if (!vocals.includes(nextLetter) && ['ed', 'ad', 'od', 'il', 'al', 'lo'].includes(clean)) {
      if (DEBUG) console.log('SKIPPED L2', element)

      return whole
    }
  }

  if (cleanLength === 3) {
    if (!nextLetter && ['non', 'una', 'che'].includes(clean)) {
      if (DEBUG) console.log('SKIPPED L3', element)

      return whole
    }
  }

  for (let iterator = 0; iterator < quantity; iterator += 1) {
    whole.push(element)
  }

  return whole
}, [])

const makeFrom = (letters = [], isReversed = false, sentence = [], group = null, sideGroups = [], preselectedLetters = null) => {
  const flowPotentials = []
  const groupPotentials = []
  const globalPotentials = []

  if (!letters.length) {
    const result = isReversed ? [...sentence].reverse() : [...sentence]
    let finale = result.pop().trim()

    const lastCharacter = finale.slice(-1)
    if (softPunctuation.includes(lastCharacter)) {
      finale = finale.replace(/.$/, _sample(hardPunctuation))
    } else if (!punctuation.includes(lastCharacter)) {
      finale += _sample(hardPunctuation)
    }

    result.push(finale)

    return result
  }

  const preselectedRemainder = preselectedLetters && letters.slice(preselectedLetters.length)
  const letterSets = preselectedLetters ? [preselectedLetters] : []
  if (!letterSets.length) {
    for (let offset = 0; offset < letters.length; offset += 1) {
      letterSets.push(offset ? letters.slice(0, -offset) : letters)
    }
  }

  if (DEBUG) console.log('letterSets', letterSets.map(set => set.join('')).join(', '))

  letterSets.forEach(set => {
    if (isReversed) {
      set.reverse()
    }

    const remainder = preselectedRemainder || (isReversed ? [...letters].reverse() : letters).slice(set.length)
    const letterString = set.join('')

    const remainderSets = []
    for (let offset = 0; offset < remainder.length; offset += 1) {
      remainderSets.push(offset ? remainder.slice(0, -offset) : remainder)
    }

    const childrenGroup = group && group[letterString]
    if (childrenGroup) {
      for (const [child, ] of Object.entries(childrenGroup)) {
        const childLetters = getLetters(child)
        const childGroup = json[childLetters][child]

        for (const remainderSet of remainderSets) {
          const remainderLetters = remainderSet.join('')

          if (Object.keys(childGroup.children).includes(remainderLetters)) {
            flowPotentials.push([letterString, childrenGroup, remainderSet])
          }
        }
      }

      groupPotentials.push([letterString, childrenGroup, null])
    }

    sideGroups.forEach(sideGroup => {
      const childrenSideGroup = sideGroup && sideGroup[letterString]
      if (childrenSideGroup) {
        groupPotentials.push([letterString, childrenSideGroup, null])
      }
    })

    if (json[letterString]) {
      globalPotentials.push([letterString, Object.fromEntries(Object.entries(json[letterString]).map(([key, value]) => [key, value.size, null])), null])
    }
  })

  // Potential Selection
  const potentialSets = [flowPotentials, groupPotentials, globalPotentials]

  //
  const sentenceCap = (sentence.slice(-1) || '').slice(-1)

  let selectedLetters
  let remainingLetters
  let nextSet
  let items = []

  let reduction = 1
  let exclusions = []
  let potentials = potentialSets.shift()
  do {
    if (DEBUG && exclusions.length) console.log('exclusions', exclusions, potentials)

    const cutPotentials = potentials.filter(([letters,]) => !exclusions.includes(letters))

    if (cutPotentials.length) {
      const sampledPotential = cutPotentials.length ? _sample(cutPotentials) : _sample(globalPotentials)

      selectedLetters = sampledPotential[0]
      nextSet = sampledPotential[2]
      remainingLetters = preselectedRemainder || (isReversed ? [...letters].reverse() : letters).slice(selectedLetters.length)

      exclusions.push(selectedLetters)

      const selectedGroup = sampledPotential[1]
      const nextLetter = remainingLetters[0]

      items = getGroupItems(selectedGroup, sentenceCap, nextLetter, reduction)
    } else {
      reduction += 1

      // if (DEBUG) console.log('reduce potential', reduction)

      exclusions = []
      potentials = potentialSets.shift()

      if (!potentialSets.length) {
        if (DEBUG) console.log('EMPTY POTENTIAL')

        // FORCE CLOSE SENTENCE UPON REACHING GLOBAL POTENTIALS? MEH
        // if (sentence.length && !punctuation.includes(sentence.slice(-1))) {
        //   sentence += '.'
        // }
      }
    }
  } while (!items.length)

  let selection = _sample(items)

  if (DEBUG) console.log(selectedLetters, selection, !!flowPotentials.length, !!groupPotentials.length)

  // SPECIFIC ELEMENT CHANGES
  if (!remainingLetters.length) {
    const endCap = selection.split('').slice(-1)

    if (endCap === 'e') {
      selection += '...'
    }
  }

  sentence.push(selection)

  const cleanSelection = cleanUp(selection)
  const selectionSidesteps = Object.keys(json[selectedLetters]).filter(key => cleanUp(key) === cleanSelection)
  const selectionSidegroups = selectionSidesteps.map(key => json[selectedLetters][key].parents)

  // if (DEBUG) console.log('SIDEGROUPS', selectionSidegroups)

  return makeFrom(remainingLetters, isReversed, sentence, json[selectedLetters][selection] ? json[selectedLetters][selection].parents : null, selectionSidegroups, nextSet)
}

const program = async () => {
  const groups = Object.keys(json)
  for (let times = 0; times < 10; times += 1) {
    const sampleKey = _sample(groups)
    const keys = Object.keys(json[sampleKey])

    // const word = cleanUp(_sample(keys)).toUpperCase()
    const word = 'VRSETALT'

    if (word.length > 1) {
      console.log(word)

      const results = []
      const splitWord = word.split('')

      // Normal
      results.push(makeFrom(splitWord))
      
      // Reversed
      results.push(makeFrom([...splitWord].reverse(), true))

      // Split Origination
      const origination = splitWord.map((letter) => {
        const letterWords = json[letter]
        if (!letterWords) {
          return false
        }

        const sampler = Object.keys(letterWords).reduce((aggregate, word) => {
          const wordSize = letterWords[word].size

          for (let iterator = 0; iterator < wordSize; iterator += 1) {
            aggregate.push(word)
          }
          
          return aggregate
        }, [])

        return sampler
      })
      const maxOriginationLength = Math.max(...origination.map(items => Array.isArray(items) && items.length))
      const preselection = origination.map((items, index) => [index, items && items.length > (maxOriginationLength * 0.75) && _sample(items)]).filter(([, items]) => !!items)
      
      const [splitIndex, originWord] = _sample(preselection)

      const preLetters = splitWord.slice(0, splitIndex)
      const postLetters = splitWord.slice(splitIndex + 1)

      results.push([...makeFrom(preLetters, true, [originWord]).slice(0, -1), originWord, ...makeFrom(postLetters, false, [originWord]).slice(1)])

      results.forEach(sentenceGroup => {
        let sentence = sentenceGroup.join(' ')

        for (let parityResult = checkParity(sentence); Array.isArray(parityResult) && !!parityResult.length;) {
          progress = true
          const [culpritIndex, ] = parityResult.pop()
  
          const split = sentence.split('')
          split.splice(culpritIndex, 1)
  
          sentence = split.join('')
  
          parityResult = checkParity(sentence)
        }
  
        if (DEBUG) console.log(starter)
  
        console.log(sentence)
      })

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

