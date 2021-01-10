const mysql = require("mysql");
const yhteys = mysql.createConnection({
                                        host     : "localhost",
                                        user     : "root",
                                        password : "",
                                        database : "ravintolaskuri"
                                    });

yhteys.connect((err) => {

    if(!err) {

        console.log("Tietokantayhteys avattu");    

    } else {

        throw `Virhe yhdistettäessä tietokantaan: ${err}`;    
        
    }
});

module.exports = {

    "haeKuivaruoat" : (callback) => {

        let sql = `SELECT * FROM kuivaruoka;`;

        yhteys.query(sql, (err, data) => {

            callback(err, data);

        });

    },

    "haeRaakaruoat" : (callback) => {

        //lihoissa ei saa olla sian haimaa valittavissa
        let sql = `SELECT * FROM raakaruoka WHERE NOT tuote = 'Sian haima';`;

        yhteys.query(sql, (err, data) => {

            callback(err, data);

        });

    },

    "haeTiedot" : (lomaketiedot, callback) => {

        let ika = lomaketiedot.ika;
        let paino = lomaketiedot.paino;
        paino = Number(paino);

        //lasketaan sinkin tarve (paino*2mg)
        let sinkinmaara = paino * 2;

        //lasketaan koiran metabolinen paino (x potenssiin 0.75)
        let metapaino = Math.pow(paino, 0.75);
        //lasketaan proteiinin vuorokausittainen tarve (metabolinen paino * 5g)
        let proteiini_tarve = metapaino * 5;

        let raakatuote = mysql.escape(`${lomaketiedot.valinta_raakaruoka}`);
        let kuivatuote = mysql.escape(`${lomaketiedot.valinta_kuivaruoka}`);

        let raakaruoanmaara = 0;

        if(lomaketiedot.aktiivisuus == "laiska") {
            //lasketaan tarvittava raakaruoan määrä (2 % (g) painosta, ja siitä 60%)
            raakaruoanmaara = paino * 20 * 0.6;
        }
        if(lomaketiedot.aktiivisuus == "normaali") {
            //lasketaan tarvittava raakaruoan määrä (2,5 % (g) painosta, ja siitä 60%)
            raakaruoanmaara = paino * 25 * 0.6;
        }
        if(lomaketiedot.aktiivisuus == "aktiivinen") {
            //lasketaan tarvittava raakaruoan määrä (3 % (g) painosta, ja siitä 60%)
            raakaruoanmaara = paino * 30 * 0.6;
        }

        let nivelrikko = 0;
        //lasketaan nivelravinteiden tarve
        let msm_tarve = 0;
        let kondr_tarve = 0;
        let gluk_tarve = 0;
        //jos nivelrikko on valittu tai ikä on vähintään 7 vuotta, nivelrikko true
        if (lomaketiedot.nivelrikko || ika >= 7) {
            nivelrikko = 1;
            //lasketaan nivelravinteiden tarve
            msm_tarve = 33.33 * paino;
            kondr_tarve = 7 * paino;
            gluk_tarve = 21 * paino;

        }

        let haimanvajaatoiminta = 0;
        let haimaproteiini = 0;
        //jos haiman vajaatoiminta on valittu, raakalihan määrästä vähennetään päivittäisen haiman määrä
        //haiman määrä on aina 190 grammaa päivässä
        const haimanmaara = 190;
        if (lomaketiedot.haimanvajaatoiminta) {
            haimanvajaatoiminta = 1;
            raakaruoanmaara = raakaruoanmaara - haimanmaara;
        }

        let tiedot = {
                        "paino" : paino,
                        "ika" : ika,
                        "proteiini_tarve" : proteiini_tarve.toFixed(0),
                        "sinkki_tarve" : sinkinmaara,
                        "aktiivisuus" : lomaketiedot.aktiivisuus,
                        "nivelrikko" : nivelrikko,
                        "haimanvajaatoiminta" : haimanvajaatoiminta,
                        "msm_tarve" : msm_tarve.toFixed(0),
                        "kondr_tarve" : kondr_tarve.toFixed(0),
                        "gluk_tarve" : gluk_tarve.toFixed(0)
        }


        let raaka_sql = `SELECT * FROM raakaruoka WHERE tuote = ${raakatuote};`;
        let kuiva_sql = `SELECT * FROM kuivaruoka WHERE tuote = ${kuivatuote};`;

        let raakaliha ="";
        let raakarasva = 0;
        let raakaproteiini = 0;
        let raakasinkki = 0;
        let raakatulos;

        let kuivanappula ="";
        let kuivarasva = 0;
        let kuivaproteiini = 0;
        let kuivasinkki = 0;
        let kuivakuitu = 0;
        let kuivamsm = 0;
        let kuivakondroitiini = 0;
        let kuivaglukosamiini = 0;  

        let varoitus = "";
        let raakavaroitus = "";

        yhteys.query(raaka_sql,(err, raaka_sql) => {

            raaka_sql.forEach((raaka) => {

                raakaliha = raaka.tuote;
                raakarasva = raaka.rasva;

                //jos haiman vajaatoiminta on valittu, rasvaa ei ruoassa saisi olla yli 11 %
                //vähennetään myös haiman ravintoarvojen määrä muusta raakaruuasta
                if (lomaketiedot.haimanvajaatoiminta && raakarasva > 11) {
                    raakavaroitus = `Huom. Valitsemasi kuivaruoka sisältää rasvaa ${raakarasva} %, joka on yli suosituksen haiman vajaatoiminnan hoidossa.`
                }

                if (lomaketiedot.haimanvajaatoiminta) {

                    let haima_sql = `SELECT proteiini, sinkki, rasva FROM raakaruoka WHERE tuote = 'Sian haima';`;

                    yhteys.query(haima_sql ,(err, haima_sql ) => {
                                
                        haima_sql.forEach((haima_sql) => {
                            haimaproteiini = haima_sql.proteiini * (haimanmaara / 100);
                            haimasinkki = haima_sql.sinkki * (haimanmaara / 100);
                            haimarasva = haima_sql.rasva;
                            raakaproteiini = raaka.proteiini / 100 * raakaruoanmaara + haimaproteiini;
                            raakasinkki = raaka.sinkki / 100 * raakaruoanmaara + haimasinkki;
                        });

                        raakatulos = {
                                        "tuote" : raakaliha,
                                        "maara" : raakaruoanmaara.toFixed(0),
                                        "rasva" : raakarasva,
                                        "proteiini" : raakaproteiini.toFixed(0),
                                        "sinkki" : raakasinkki.toFixed(0),
                                        "haimarasva" : haimarasva,
                                        "raakavaroitus" : raakavaroitus
                        }

                    });


                } else {
                    raakaproteiini = raaka.proteiini / 100 * raakaruoanmaara;
                    raakasinkki = raaka.sinkki / 100 * raakaruoanmaara;
                

                    raakatulos = {
                                    "tuote" : raakaliha,
                                    "maara" : raakaruoanmaara.toFixed(0),
                                    "rasva" : raakarasva,
                                    "proteiini" : raakaproteiini.toFixed(0),
                                    "sinkki" : raakasinkki.toFixed(0)
                    }
                }
            });

            yhteys.query(kuiva_sql,(err, kuiva_sql) => {

                kuiva_sql.forEach((kuiva) => {

                    kuivanappula = kuiva.tuote;
                    kuivaruoanmaara = kuiva.g_per_5kg;
                    kuivarasva = kuiva.rasva;
                    kuivaproteiini = kuiva.proteiini;
                    kuivasinkki = kuiva.sinkki;
                    kuivakuitu = kuiva.kuitu;
                    kuivamsm = kuiva.msm;
                    kuivakondroitiini = kuiva.kondroitiini;
                    kuivaglukosamiini = kuiva.glukosamiini;
                    
                });
                
                if(paino < 10){
                    //lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä)
                    kuivaruoanmaara = kuivaruoanmaara / 5 * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara;
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara; 
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }
                if(paino >= 10 && paino < 20){
                    /*lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä), 
                    ruoan grammamäärä per koiran painokilo on 25 % vähemmän kuin alle 10 kg painavan koiran*/
                    kuivaruoanmaara = (kuivaruoanmaara / 5 - kuivaruoanmaara / 5 *0.25) * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara; 
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara;
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }
                if(paino >= 20 && paino <= 27){
                    /*lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä), 
                    ruoan grammamäärä per koiran painokilo on 30 % vähemmän kuin alle 10 kg painavan koiran*/
                    kuivaruoanmaara = (kuivaruoanmaara / 5 - kuivaruoanmaara / 5 *0.3) * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara; 
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara;
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }
                if(paino > 27 && paino <= 44){
                    /*lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä), 
                    ruoan grammamäärä per koiran painokilo on 40 % vähemmän kuin alle 10 kg painavan koiran*/
                    kuivaruoanmaara = (kuivaruoanmaara / 5 - kuivaruoanmaara / 5 * 0.4) * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara; 
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara;
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }
                if(paino > 44 && paino <= 64){
                    /*lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä), 
                    ruoan grammamäärä per koiran painokilo on 45 % vähemmän kuin alle 10 kg painavan koiran*/
                    kuivaruoanmaara = (kuivaruoanmaara / 5 - kuivaruoanmaara / 5 *0.45) * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara; 
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara;
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }
                if(paino > 64){
                    /*lasketaan kuivaruoan määrä (50 % valmistajan ilmoittamasta määrästä), 
                    ruoan grammamäärä per koiran painokilo on 50 % vähemmän kuin alle 10 kg painavan koiran*/
                    kuivaruoanmaara = (kuivaruoanmaara / 5 - kuivaruoanmaara / 5 *0.50) * paino * 0.5;
                    kuivaproteiini = kuivaproteiini / 100 * kuivaruoanmaara; 
                    kuivasinkki = kuivasinkki / 100 * kuivaruoanmaara;
                    kuivamsm = kuivamsm / 100 * kuivaruoanmaara;
                    kuivakondroitiini = kuivakondroitiini/ 100 * kuivaruoanmaara;
                    kuivaglukosamiini = kuivaglukosamiini / 100 * kuivaruoanmaara;
                }

                //jos haiman vajaatoiminta on valittu, rasvaa ei ruoassa saisi olla yli 11 % eikä kuitua yli 3.5 %
                if (lomaketiedot.haimanvajaatoiminta && kuivakuitu > 3.5) {

                    varoitus = `Huom. Valitsemasi kuivaruoka sisältää kuitua ${kuivakuitu} %, joka on yli suosituksen haiman vajaatoiminnan hoidossa.`

                }
                if (lomaketiedot.haimanvajaatoiminta && kuivarasva > 11) {

                    varoitus = `Huom. Valitsemasi kuivaruoka sisältää rasvaa ${kuivarasva} %, joka on yli suosituksen haiman vajaatoiminnan hoidossa.`

                }

                kuivatulos = {
                    "tuote" : kuivanappula,
                    "maara" : kuivaruoanmaara.toFixed(0),
                    "rasva" : kuivarasva,
                    "proteiini" : kuivaproteiini.toFixed(0),
                    "kuitu" : kuivakuitu,
                    "sinkki" : kuivasinkki.toFixed(0),
                    "msm" : kuivamsm.toFixed(0),
                    "kondroitiini" : kuivakondroitiini.toFixed(0),
                    "glukosamiini" : kuivaglukosamiini.toFixed(0),
                    "varoitus" : varoitus
                }

                callback(err, raakatulos, kuivatulos, tiedot);

            });

        });

    },
    
    "haeKayttaja" : (tunnus, callback) => {

        tunnus = mysql.escape(`${tunnus}`);
        let sql_tunnus = `SELECT * FROM kayttaja WHERE tunnus = ${tunnus};`;

        yhteys.query(sql_tunnus,(err, kayttaja) => {
         
            if(!kayttaja.lenght == undefined) {
                kayttaja.forEach((kayttaja) => {

                        kayttaja_id = kayttaja.kayttaja_id;
                        kayttajatunnus = kayttaja.tunnus;
                        salasana = kayttaja.salasana;
                        
                    });

                    kayttaja = {
                        "kayttaja_id" : kayttaja_id,
                        "kayttajatunnus" : kayttajatunnus,
                        "salasana" : salasana
                    }

            }

            callback(err, kayttaja);
        
        });

    },

    "lisaaKayttaja" : (uusi, callback) => {

        yhteys.query("INSERT INTO `kayttaja`(`kayttaja_id`,`tunnus`, `salasana`) VALUES (NULL, ?, ?)", [uusi.kayttajatunnus, uusi.salasana], (err) => {
            
            callback(err);

        });
        
    },

    "haeKoira" : (kayttaja, callback) => {

        let kayttaja_id = kayttaja.id;

        let sql = `SELECT * FROM koira WHERE kayttaja_id = ${kayttaja_id};`

        yhteys.query(sql, (err, data) => {

            callback(err, data);

        });

    },

    "tallennaTiedot" : (tiedot, callback) => {

        

        if(tiedot.nimi != ""){
            
            yhteys.query("INSERT INTO `koira`(`id`,`kayttaja_id`,`nimi`,`paino`,`ika`,`aktiivisuus`,`nivelrikko`,`haimanvajaatoiminta`,`proteiini_tarve`,`sinkki_tarve`,`msm_tarve`,`kondroitiini_tarve`,`glukosamiini_tarve`,`raaka_valittu`,`raaka_maara`,`raaka_proteiini`,`kuiva_valittu`,`kuiva_maara`,`kuiva_proteiini`,`kuiva_sinkki`) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [tiedot.kayttaja_id, tiedot.nimi, tiedot.paino, tiedot.ika, tiedot.aktiivisuus, tiedot.nivelrikko, tiedot.haimanvajaatoiminta, tiedot.proteiini_tarve, tiedot.sinkki_tarve, tiedot.msm_tarve, tiedot.kondr_tarve, tiedot.gluk_tarve, tiedot.raaka_valittu, tiedot.raaka_maara, tiedot.raaka_proteiini, tiedot.kuiva_valittu, tiedot.kuiva_maara, tiedot.kuiva_proteiini, tiedot.kuiva_sinkki ], (err) => {

                callback(err);

            });
        }

        if(tiedot.valmisKoira != ""){
            let sql= "UPDATE koira SET paino=?, ika=?, aktiivisuus=?, nivelrikko=?, haimanvajaatoiminta=?, proteiini_tarve=?, sinkki_tarve=?, msm_tarve=?, kondroitiini_tarve=?, glukosamiini_tarve=?, raaka_valittu=?, raaka_maara=?, raaka_proteiini=?, kuiva_valittu=?, kuiva_maara=?, kuiva_proteiini=?, kuiva_sinkki=? WHERE nimi = ?";

            yhteys.query(sql, [tiedot.paino, tiedot.ika, tiedot.aktiivisuus, tiedot.nivelrikko, tiedot.haimanvajaatoiminta, tiedot.proteiini_tarve, tiedot.sinkki_tarve, tiedot.msm_tarve, tiedot.kondr_tarve, tiedot.gluk_tarve, tiedot.raaka_valittu, tiedot.raaka_maara, tiedot.raaka_proteiini, tiedot.kuiva_valittu, tiedot.kuiva_maara, tiedot.kuiva_proteiini, tiedot.kuiva_sinkki, tiedot.valmisKoira], (err) => {
                
                callback(err);

            });

        }
    }

}        
