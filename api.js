const version = '2203.11.0'
const ValorantAPI = require("unofficial-valorant-api")
const express = require('express');
const app = express();

app.use(express.json());


app.listen(process.env.PORT || 5000, () => {
  console.log('Servidor rodando =)')
})

app.get('/', async (request, response) => {
  response.json("Bem-vindo(a)! Para consultar o rank deste ato informe a url completa! -> https://danieeldev-valorantapi.herokuapp.com/api/mmr/{regiao}/{nome}/{tag} = Exemplo: https://danieeldev-valorantapi.herokuapp.com/api/mmr/br/coreano/br1")
})

app.get('/api/version', (request, response) => {
  response.json(`FREE Valorant-API powered by DanieelDev => API v${version}`)
  return response.status(200)
})

app.get('/api/mmr/:region/:name/:tag', async (request, response) => {
  const region = request.params.region || "br1"
  const name = request.params.name
  const tag = request.params.tag
  if (!region || !name || !tag) {
    return response.status(400)
  }
  const mmr = await ValorantAPI.getMMR("v2", region, name, tag)
  const current_data = mmr.data.current_data || null
  if (mmr && mmr.status && mmr.status === 429) {
    response.json("< API sobrecarregada, tente novamente em alguns minutos >")
    return response.status(429)
  }
  console.log(mmr)
  if (!current_data) {
    response.json(`< Nenhum dado encontrado. (${mmr.status})>`)
    return response.status(404)
  }
  if (!current_data.currenttierpatched) {

    response.json(`< Sem dados desse ato. (${mmr.status})>`)
    return response.status(404)
  }
  var listRanks = {
    iron: 'Ferro',
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    platinum: 'Platina',
    diamond: 'Diamante',
    immortal: 'Imortal',
    radiant: 'Radiante'
  }

  var retorno = ""
  var rank = (current_data.currenttierpatched.split(' ')[0] || '').trim().toLowerCase()
  var nivel = current_data.currenttierpatched.split(' ')[1] || ''

  var rankRet = listRanks[rank] || 'Sem rank/elo'
  var crRet = current_data.ranking_in_tier || 0

  if (rankRet === 'Radiante') {
    retorno = `${rankRet} - ${crRet} CR`
  } else {
    if (nivel.length > 0) {
      retorno = `${rankRet} ${nivel} - ${crRet} CR`
    } else {
      retorno = `${rankRet} - ${crRet} CR`
    }
  }
  if (rankRet === 'Sem rank/elo') {
    retorno = 'Sem rank/elo'
  }
  response.json(retorno)
})
