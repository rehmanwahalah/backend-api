const mongoose = require('mongoose');
const UserGroup = mongoose.model('Group');
//mongo connection
mongoose.connect('mongodb://127.0.0.1:27017/backend_api')

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function () {
    console.log('Successfully connected to MongoDB server!')
})


    (async () => {
        try {

            var data = {
                title: 'Public'
            }
            var data1 = {
                title: 'Private'
            }
            var data2 = {
                title: 'Social'
            }
            var userGroup = new UserGroup(data)
            await userGroup.save()

            userGroup = new UserGroup(data1)
            await userGroup.save()

            userGroup = new UserGroup(data2)
            await userGroup.save()
        } catch (error) {
            console.log(error.toString())
        }
    })();

