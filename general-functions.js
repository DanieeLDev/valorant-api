const ValorantAPI = require("unofficial-valorant-api");
const replaceSpecialCharacters = require('replace-special-characters');
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
    return `< Sem dados desse ato. (${status})>`;
  }

  return null
}

exports.getRankTraduction = (a) => {
  return listRanks[a] || listRanks['Unrated'];
}

exports.organizeRankText = (type, cr, fullRank, region, name, tag) => {
  return new Promise((resolve, reject) => {
    type = Number(type || 0)

    var a = fullRank.split(' ')[0].trim()
    var b = fullRank.split(' ')[1]

    if (type === 0) {

      if (a === 'Radiant') {
        resolve(`${this.getRankTraduction(a)} - ${cr} CR`) // retorna "Radiante - 324 CR"
      } else {
        resolve(`${this.getRankTraduction(a)} ${b} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
      }
    }
    if (type === 1) {
      resolve(this.getRankTraduction(a)); // retorna "Ferro" "Radiante"
    }
    if (type === 2) {

      if (a === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {

          if (leader.status === 404) {
            resolve(this.getRankTraduction(a)); // deu erro retorna so "Radiante"
          } else {
            resolve(`${this.getRankTraduction(a)} #${leader.data.data[0].leaderboardRank}`) // retorna "Radiante #15"
          }
        }).catch(() => { resolve(this.getRankTraduction(a)) })
      } else {
        resolve(this.getRankTraduction(a)); // retorna so "Imortal"
      }

    }
    if (type === 3) {
      if (a === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {
          if (leader.status === 404) {
            resolve(`${this.getRankTraduction(a)} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
          } else {
            resolve(`${this.getRankTraduction(a)} #${leader.data.data[0].leaderboardRank} - ${cr} CR`) // retorna "Radiante #15 - 316 CR"
          }
        }).catch(() => { resolve(this.getRankTraduction(a)) })
      } else {
        resolve(`${this.getRankTraduction(a)} ${b} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
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