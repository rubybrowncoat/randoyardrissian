const markov = require('./markovio')

const json = require('./knowledge-markovio.json')

const DEBUG = process.argv.includes('debug')

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

const program = async () => {
  const dataset = markov.newDataSet()

  dataset.import(json)

  for (let times = 0; times < 10; times += 1) {
    const word = 'VRSETALT'

    if (word.length > 1) {
      const starter = dataset.generateFrom(word.split(''), false)

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

      console.log('')
    }
  }
}

program()