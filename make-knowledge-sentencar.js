const efes = require('fs')
const path = require('path')

const junk = require('junk')

const msgpack = require('@msgpack/msgpack')

const directory = './knowledge-texts'

const DEBUG = process.argv.includes('debug')

async function* getFiles(dir) {
  const dirents = await efes.promises.readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

const cleanUp = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, ' ').replace(/\s+/g, '').trim()
const getLetters = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zA-Z]/g, ' ').trim().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/[a-z]/g, ' ').replace(/\s+/g, '').trim()

const repository = {}

const abbreviations = ['mr', 'ms', 'sig', 'sigg', 'sigra', 'signa', 'mm', 'cm']

const sentenceOpeners = ['(', '[', '{', '«', '‘', '“']
const sentenceClosers = ['!', '?', '.']

const program = async () => {
  let iteration = 0

  for await (const filename of getFiles(directory)) {
    if (!efes.existsSync(filename) || junk.is(filename)) {
      continue
    }

    const contents = efes.readFileSync(filename, 'utf-8')

    console.log(filename)

    const words = contents.split(/\s+/)
    console.log('word tokens count', words.length)

    let builder = ''
    const sentences = words.reduce((aggregate, word, index) => {
      const cleanWord = cleanUp(word).toLowerCase()
      
      const startSlice = word.slice(0, 3)
      const cleanStart = cleanUp(startSlice)
      if ((cleanUp(startSlice).match(/[A-Z]/) || !cleanStart) && sentenceOpeners.some(opener => startSlice.includes(opener))) {
        if (builder) {
          aggregate.push(builder.trim())
        }

        builder = ''
      }

      builder += `${word} `

      const endSlice = word.slice(word.length - 3)
      if (sentenceClosers.some(closer => endSlice.includes(closer)) && !abbreviations.includes(cleanWord)) {
        if (cleanWord.length >= 2) {
          if (builder) {
            aggregate.push(builder.trim())
          }

          builder = ''
        }
      }
      
      return aggregate
    }, [])

    efes.writeFileSync('sentences.json', JSON.stringify(sentences, null, 2))

    let previous = ''
    for (const sentence of sentences) {
      const cleanSentence = sentence.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F\xAD]/g, '')
      const letters = getLetters(cleanSentence)


      if (!repository[letters]) {
        repository[letters] = []
      }

      repository[letters].push(cleanSentence)
    }

    // EARLY BREAK
    // if (iteration === 0) {
    //   console.log('PARTIAL DONEZO')

    //   efes.writeFileSync('knowledge-sentencar.json', JSON.stringify(repository, null, 2))

    //   process.exit()
    // }

    iteration += 1
  }

  console.log('FULL DONEZO')

  const encoded = msgpack.encode(repository)
  const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)

  efes.writeFileSync('knowledge-sentencar.json', JSON.stringify(repository, null, 2))
  efes.writeFileSync('knowledge-sentencar.msp', buffer)
}

program()
