const ValorantAPI = require("unofficial-valorant-api");
const replaceSpecialCharacters = require('replace-special-characters');
const { updateLastPingedDB } = require("./dabatase-functions.js");
var package = require('./package.json'); // pega o package

var cache = {}

const listRanks = {
  Iron: 'Ferro',
  Bronze: 'Bronze',
  Silver: 'Prata',
  Gold: 'Ouro',
  Platinum: 'Platina',
  Diamond: 'Diamante',
  Immortal: 'Imortal',
  Radiant: 'Radiante',
  Unrated: 'Sem elo/rank'
}

exports.adjustAccountName = (accountName) => {
  return replaceSpecialCharacters(accountName);
}

exports.getFullVersion = () => {
  return `FREE Valorant-API powered by ${package.author} => API v${package.version}`
}

exports.getCacheById = (id) => {
  if (id) {
    return cache[id]
  }
  return cache
}

exports.hasError = (mmr, status) => {
  if (!status) {
    return "< Nenhum dado foi encontrado na RIOT >";
  }
  if (status === 503) {
    return "< HTTPS 503 - Tente novamente em alguns minutos>";
  }
  if (status === 404) {
    return "< Nenhum dado encontrado na RIOT >";
  }
  if (status === 429) {
    console.log('mmr ratelimits ->' + mmr.ratelimits)
    if (mmr.ratelimits && mmr.ratelimits.remaining && mmr.ratelimits.remaining > 0) {
      return '< Conta não encontrada, verifique os caracteres especiais e tente novamente >'
    }
    return "< API sobrecarregada, - Tente novamente em alguns minutos >";
  }
  if (!mmr.data.current_data) {
    return `< Nenhum dado encontrado. (${status})>`;
  }
  if (!mmr.data.current_data.currenttierpatched) {
    return this.getRankTraduction('Unrated');
  }

  return null
}

exports.getRankTraduction = (a) => {
  return listRanks[a] || listRanks['Unrated'];
}

exports.organizeRankText = (type, cr, fullRank, region, name, tag) => {
  return new Promise((resolve, reject) => {
    // types
    // 0 -> "Ouro 1 - 34 CR"
    // 1 -> "Ouro 1"
    // 2 -> "Radiante #12"
    // 3 -> "Radiante #12 - 412 CR"

    type = Number(type || 0)

    var rank = fullRank.split(' ')[0].trim()
    var tier = fullRank.split(' ')[1]


    var stringRank = this.getRankTraduction(rank)

    var stringRankTier = null
    if (tier) {
      stringRankTier = `${this.getRankTraduction(rank)} ${tier}`
    }


    if (type === 0) {
      resolve(`${stringRank} - ${cr} CR`) // ex: "Ferro 3 - 23 CR"
    }

    if (type === 1) {
      resolve(stringRank); // ex: "Ferro 3"  ou "Radiante"
    }

    if (type === 2 || type === 3) {

      if (rank === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {

          if (leader.status === 404) {
            resolve(`${stringRank} - ${cr} CR`)
            console.log('deu 404')
          } else {
            console.log('deu certo')
            var base = `${stringRank} #${leader.data.data[0].leaderboardRank}`
            var ret = base
            if (type === 3) {
              ret = `${base} - ${cr} CR`
            }
            resolve(ret) // retorna "Radiante #15"
          }
        }).catch(() => {
          console.log('deu catch')
          resolve(`${stringRank} - ${cr} CR`) // ex: "Diamante 2 - 73 CR"
        })
      } else {
        resolve(`${stringRank} - ${cr} CR`) // ex: "Diamante 2 - 73 CR"
      }

    }

  })

}

exports.clearOldCache = () => {
  Object.entries(cache).forEach(([key, account]) => {
    if (account.ttl < new Date()) {
      delete cache[key]
    }
  });
}
exports.clearAllCache = () => {
  cache = {}
}

exports.updateCacheAccount = (account, rank) => {
  var oDate = new Date()
  oDate.setMinutes(oDate.getMinutes() + 10) // esse cache é valido por 10min

  cache[account] = {
    rank,
    ttl: oDate
  }
  console.log('atualizando cache')

  this.clearOldCache(); // aproveita pra limpar caches antigos
}

exports.updateLastPinged = (lastPinged = new Date()) => {
  return updateLastPingedDB(lastPinged)
}