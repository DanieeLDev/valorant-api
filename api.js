const ValorantAPI = require("unofficial-valorant-api")
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());


app.listen(3333, () => {
    console.log('Servidor rodando =)')
})

app.get('/api/mmr/:region/:name/:tag', async (request, response) => {
    const region = request.params.region
    const name = request.params.name
    const tag = request.params.tag
    if (!region || !name || !tag) {
        return response.status(400)
    }
    const mmr = await ValorantAPI.getMMR("v1", region, name, tag)
    if (mmr && mmr.status && mmr.status === 429) {
        response.json("< Indisponível no momento >")
        return
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
    var rank = (mmr.data.currenttierpatched.split(' ')[0] || '').trim().toLowerCase()
    var nivel = mmr.data.currenttierpatched.split(' ')[1] || ''

    if (rank === 'radiant') {
        retorno = `${listRanks[rank]} - ${mmr.data.ranking_in_tier} CR`
    } else {

        if (nivel.length > 0) {
            retorno = `${listRanks[rank]} ${nivel} - ${mmr.data.ranking_in_tier} CR`
        } else {
            retorno = `${listRanks[rank]} - ${mmr.data.ranking_in_tier} CR`
        }
    }
    response.json(retorno)
})


