const Sequelize = require('sequelize');
const http = require('http');
const async = require('async');

const sequelize = new Sequelize('tempstats', 'tempstats', 'tempstats', {
    host: 'localhost',
    dialect: 'mysql',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

const Temperature = sequelize.define('temperature', {
    date: Sequelize.DATE,
    sensor: Sequelize.STRING,
    currentTemp: Sequelize.INTEGER,
    targetTemp: Sequelize.INTEGER,
    humidity: Sequelize.FLOAT,
    valve: Sequelize.INTEGER
}, {
    freezeTableName: true,
    timestamps: false
});

Temperature.removeAttribute('id');


var sensors = [
    { url: 'http://fhem:8083/fhem?XHR=1&cmd=jsonlist2%20HM_HEIZ_SZ_Clima%20STATE' },
    { url: 'http://fhem:8083/fhem?XHR=1&cmd=jsonlist2%20HM_HEIZ_WZ_LI_Clima%20STATE' },
    { url: 'http://fhem:8083/fhem?XHR=1&cmd=jsonlist2%20HM_HEIZ_WZ_RE_Clima%20STATE' },
    { url: 'http://fhem:8083/fhem?XHR=1&cmd=jsonlist2%20HM_THERM_SZ_Weather%20STATE' },
    { url: 'http://fhem:8083/fhem?XHR=1&cmd=jsonlist2%20HM_THERM_WZ_Weather%20STATE' }
];

async.each(sensors, function(sensor, callback) {
    http.get(sensor.url, function(resp) {
        var data = '';

        // A chunk of data has been recieved.
        resp.on('data', function(chunk) {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', function() {
            //console.log(data);
            var mySensor = JSON.parse(data);
            var sensorState = mySensor.Results[0].Internals.STATE;
            var weatherMatches = sensorState.match(/T: ([0-9.]+) H: ([0-9.]+)/);
            if (weatherMatches) {
                var temperature = weatherMatches[1];
                var humidity = weatherMatches[2];
                //console.log('sensor', temperature, humidity);
                Temperature.build({
                    sensor: mySensor.Results.Name,
                    currentTemp: temperature,
                    humidity: humidity
                }).save().then(function() {
                    callback();
                }).catch(function (err) {
                    callback(err);
                });
            } else {
                var heaterMatch = sensorState.match(/T: ([0-9.]+) desired: ([0-9.]+) valve: ([0-9]+)/);
                if (heaterMatch) {
                    var temperature = heaterMatch[1];
                    var targetTemperature = heaterMatch[2];
                    var valve = heaterMatch[3];
                    //console.log('heater', temperature, targetTemperature, valve);
                    Temperature.build({
                        sensor: mySensor.Results.Name,
                        currentTemp: temperature,
                        targetTemperature: targetTemperature,
                        valve: valve
                    }).save().then(function() {
                        callback();
                    }).catch(function (err) {
                        callback(err);
                    });
                }
            }
        });
    });
}, function(err) {
    if (err) {
        console.error(err);
    }
    sequelize.close();
});

