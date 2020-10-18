const fs = require('fs')
const _sample = require('lodash/sample')

const punctuationSampler = [
  ...(new Array(6).fill('.')),
  ...(new Array(3).fill(',')),
  '…',
  ':', ';',
  '!', '!?', '!!!', '?',
]

const endPuntuationSampler = [
  ...(new Array(4).fill('.')),
  '…',
  '!', '!?', '!!!', '?',
]

function check(letter) {
  const checkLetter = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase()

  return word => word ? word[0] === checkLetter : false
}

// format string for training
function trimAndFormat(string, lineBreaks) {
  const separatedStrings = lineBreaks ? string.replace(/\n+/g, ' \n ').replace(/[^\S\n]+/g, ' ').split('\n') : [string.replace(/\n+/g, ' ').replace(/\s+/g, ' ')]

  const normalizedStrings = separatedStrings.map(line => {
    const traditionalLine = line.replace(/[^a-zA-Z\u00C0-\u017F]/g, " ").replace(/\s+/g, " ").trim()
    // const normalizedLine = line.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, " ").replace(/\s+/g, " ").trim()

    return traditionalLine || null
    // return normalizedLine || null
  }).filter(f => f)

  return normalizedStrings
}

// dataset constructor for exports
exports.newDataSet = function () {
  return new DataSet()
}

// object to training and markov generation
function DataSet() {
  this.data = {} // map of ngrams to their possibilities
  this.capitalized = [] // list of all capitalized ngrams
  this.fullCorpus = ""

  this.keyed = function (gram) {
    return gram.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase()
  }

  // train on a string using a given ngram size
  this.trainOnString = function (string, preserveLineBreaks) {
    this.fullCorpus += `\n${string}`

    const lines = trimAndFormat(string, preserveLineBreaks)

    for (let lineIterator = 0; lineIterator < lines.length; lineIterator += 1) {
      const line = lines[lineIterator]
      const words = line.split(' ')

      if (words.length) {
        for (let wordIterator = 0; wordIterator < words.length; wordIterator += 1) {
          const word = words[wordIterator]
          const next = words[wordIterator + 1] || false

          const [wordKey] = this.updateGram(word, next)

          if (wordIterator === 0) {
            if (this.capitalized.indexOf(wordKey) === -1) {
              this.capitalized.push(wordKey)
            }
          }
        }
      }
    }
  }

  // read in a file and train using a given ngram size
  this.trainOnFile = function (filename, preserveLineBreaks, callback) {
    var self = this

    // if single file given
    if (typeof filename === 'string' || filename instanceof String) {
      // read given file
      fs.readFile(filename, 'UTF8', function (err, data) {
        if (err) throw err

        // train on file content string
        self.trainOnString(data, preserveLineBreaks)
        callback()
      });

      // if array of filenames given
    } else if (filename instanceof Array) {
      var fullData = ""
      var completed = 0

      // read each file
      for (var i = 0; i < filename.length; i++) {
        fs.readFile(filename[i], 'UTF8', function (err, data) {
          if (err) throw err

          completed++ // increment number of files read
          fullData += `\n${data}` // add file contents

          // if all files read
          if (completed == filename.length) {
            // train on full string and callback
            self.trainOnString(fullData, preserveLineBreaks)
            callback()
          }
        })
      }
    }
  }

  // // generate a given amount of words based on
  // this.generate = function (size, capitalize) {
  //   // start text with a random ngram chain from hashmap
  //   var randKey = capitalize && this.capitalized.length > 0 ? this.capitalized : Object.keys(this.data);
  //   var markovText = randKey[Math.floor(Math.random() * randKey.length)].split('^');

  //   if (size) {
  //     // for length requested
  //     for (var i = 0; i < size - 1; i++) {
  //       // extract the last n words from current generated text
  //       var lastNGram = key(markovText.slice(markovText.length - 1, markovText.length));

  //       // get all possible following words
  //       var possibilities = this.data[lastNGram];

  //       // apply a random possible next word
  //       var next = possibilities[Math.floor(Math.random() * possibilities.length)];
  //       markovText.push(next);
  //     }

  //     // join result with spaces
  //     return markovText.join(' ');
  //   } else {
  //     return undefined;
  //   }
  // }

  this.generateFrom = function (lettersArray, capitalize) {
    const dataKeys = Object.keys(this.data)

    const initialSet = capitalize && this.capitalized.length > 0 ? this.capitalized : dataKeys
    const alternativeSet = capitalize && this.capitalized.length > 0 ? dataKeys : this.capitalized

    if (lettersArray.length) {
      const markovText = []
      for (let iterator = 0; iterator < lettersArray.length; iterator += 1) {
        const letter = lettersArray[iterator]
        const letterCheck = check(letter)

        const lastWord = markovText[markovText.length - 1]
        const lastKey = lastWord ? this.keyed(lastWord) : lastWord

        let plausibleSet = []

        if (lastWord) {
          const wordSet = this.data[lastKey]
          const { followers = [] } = wordSet

          plausibleSet = followers.filter(letterCheck)
        }

        if (!lastWord || !plausibleSet.length) {
          if (lastWord) {
            markovText[markovText.length - 1] += _sample(punctuationSampler)
          }

          plausibleSet = initialSet.filter(letterCheck)

          if (!plausibleSet.length) {
            plausibleSet = alternativeSet.filter(letterCheck)
          }
        }

        if (!plausibleSet.length) {
          return undefined
        }

        const selectionKey = _sample(plausibleSet)
        const selectionSet = this.data[selectionKey]
        const { displays } = selectionSet

        const selectionDisplay = _sample(displays)

        markovText.push(selectionDisplay)
      }

      if (Math.random() > 0.25) {
        markovText[markovText.length - 1] += _sample(endPuntuationSampler)
      }

      return markovText.join(' ')
    } else {
      return undefined
    }
  }

  // check if a string is fully original from the training corpus
  this.checkOriginality = function (string) {
    return this.fullCorpus.indexOf(string) == -1 ? true : false;
  }

  // reset any training data
  this.clearData = function () {
    this.data = {};
    this.capitalized = [];
    this.fullCorpus = "";
  }

  // get all possible words following a given ngram
  this.getPossibilities = function (gram) {
    const wordSet = this.data[this.keyed(gram)]

    return wordSet ? wordSet.followers.length : 0
  }

  // manually add new ngram, word pair to dataset
  this.updateGram = function (word, next) {
    const [wordKey, nextKey] = [word, next].map(wordNext =>
      wordNext ? this.keyed(wordNext) : wordNext
    )

    if (this.data[wordKey]) {
      const { displays, followers } = this.data[wordKey]

      if (next) {
        followers.push(nextKey)
      }

      if (displays.indexOf(word) === -1) {
        displays.push(word)
      }
    } else {
      this.data[wordKey] = {}
      this.data[wordKey].displays = [word]

      this.data[wordKey].followers = next ? [next] : []
    }

    return [wordKey, nextKey]
  }

  this.export = function (directory = '.') {
    const data = {
      data: this.data,
      capitalized: this.capitalized,
    }

    fs.writeFile(`${directory}/knowledge-markovio.json`, JSON.stringify(data), function (err) {
      if (err) throw err;

      console.log('training complete')
    })
  }

  this.import = function (trained) {
    this.data = trained.data
    this.capitalized = trained.capitalized

    return this
  }
}
