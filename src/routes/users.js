import { Router } from 'express';
import mongoose from 'mongoose'
const User = mongoose.model('User')
const Friend = mongoose.model('Friend')
const Group = mongoose.model('Group')
// import * as userController from '../controllers/users';
// import { Friend } from '../db/models/friend';
// import { User } from '../db/models/user';
import authenticate from '../middlewares/authenticate'
import { getAllUsers, getUserById, deleteUserById, getUserByIdentifier, getUserProfileWithFriendshipStatus } from '../db/controllers/user'
import { getInvitationByIdentifier, isInviteadByUser } from '../db/controllers/invitation'
import { getAllUserGroups, getUserGroupById, deleteGroupById } from '../db/controllers/group'
import { deleteFriendshipRequset, friendshipRequset } from '../validations/auth'
import { validateContactList } from '../validations/users'

const router = Router();


router.get('/', authenticate, async (req, res, next) => {
    const { id: currentUserId } = req.currentUser;

    let query = { _id: { $ne: currentUserId } }
    let limit = 20;
    let offset = 0;
    if (typeof req.query.limit !== 'undefined') {
        limit = req.query.limit;
    }
    if (typeof req.query.offset !== 'undefined') {
        offset = req.query.offset;
    }

    try {
        let result = await getAllUsers(query, limit, offset)

        return res.status(200).json({ users: result[0], total: result[1] })
    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/get-contacts-detail', authenticate, async (req, res, next) => {

    const { id: currentUserId } = req.currentUser;
    try {
        const { errors, isValid } = validateContactList(req.body);
        if (!isValid) { return res.status(500).json({ errors }) };

        const { contacts } = req.body
        let users = [];
        let invited = [];
        let notfound = [];

        let user;
        let invitedUser;
        for (const contact of contacts) {
            user = await getUserByIdentifier(contact.phonenumber)
            if (user) {
                // console.log(user.isFriend(currentUserId))
                // console.log(await user.populate('friends').execPopulate());
                let data = await user.populate({ path: 'friends', select: { 'status': 1, 'friend': 1, 'user': 1 }, match: { friend: currentUserId } }).execPopulate();
                // user.friendShipStatus = data.friends
                let myUser = JSON.parse(JSON.stringify(user))//Object.assign({}, user);
                myUser.friendshipStatus = ''
                if (data.friends.length) {
                    myUser.friendshipStatus = data.friends[0].status;
                }

                delete myUser.postNotification;
                delete myUser.peerNotification;
                delete myUser.privateMsgNotification;
                delete myUser.emailVerified;
                delete myUser.phoneVerified;
                delete myUser.dob;
                delete myUser.gender;

                users.push(myUser);
            } else if (!user) {
                invitedUser = await isInviteadByUser(contact.phonenumber, currentUserId)
                if (invitedUser) {
                    invited.push(invitedUser);
                } else {
                    notfound.push(contact);
                }
            }
        }
        return res.status(200).json({ users, invited, notfound })

    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.get('/:id', authenticate, async (req, res, next) => {
    const { id } = req.params;
    try {
        let user = await getUserById(id)
        return res.status(200).json({ user: user.toJSON() });
    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});
router.delete('/:id', authenticate, async function (req, res, next) {
    const { id } = req.params;

    try {
        await deleteUserById(id)
        return res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/add-to-friendship-list', authenticate, async function (req, res, next) {
    const { id } = req.currentUser;
    const { errors, isValid } = friendshipRequset(req.body)
    if (!isValid) { return res.status(500).json({ errors }) }

    try {
        let { userId, groupId } = req.body;


        let userFriendObj = await Friend.findOne({ user: id })
        let requestedUserFriendObj = await Friend.findOne({ user: userId })

        if (!userFriendObj && !requestedUserFriendObj) {
            return res.status(500).json({ errors: { error: error.toString() }, message: 'Friend request objects not exist with given userId.' })
        }
        userFriendObj.group = groupId;
        userFriendObj.status = 'friend';
        await userFriendObj.save();

        requestedUserFriendObj.status = 'friend';
        await requestedUserFriendObj.save();

        return res.status(200).json({ user: requestedUserFriendObj, user2: userFriendObj });

    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/remove-from-friendship-list', authenticate, async function (req, res, next) {
    const { id } = req.currentUser
    const { errors, isValid } = deleteFriendshipRequset(req.body)
    if (!isValid) { return res.status(500).json({ errors }) }

    try {
        const { userId } = req.body;

        let user = await getUserById(id)
        let requestedUser = await getUserById(userId)

        if (!requestedUser) {
            return res.status(500).json({ message: 'User not exist with such UserId.' })
        }
        let userFriendObj = await Friend.findOne({ user: id })
        let requestedUserFriendObj = await Friend.findOne({ user: userId })

        if (!userFriendObj && !requestedUserFriendObj) {
            return res.status(500).json({ message: 'Friend request objects not exist with given userId.' })
        }

        let friendId = userFriendObj._id;
        let friendId1 = requestedUserFriendObj._id

        await userFriendObj.remove()
        await requestedUserFriendObj.remove()

        await user.removeRequestFriendship(friendId);
        await requestedUser.removeRequestFriendship(friendId1);

        return res.status(200).json({ message: 'Contact un friend successfully.' })

    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/requset-friendship', authenticate, async function (req, res, next) {
    const { id } = req.currentUser
    const { errors, isValid } = friendshipRequset(req.body)
    if (!isValid) { return res.status(500).json({ errors }) }

    try {
        const { userId, groupId } = req.body;

        let myUser = await getUserById(id)
        let addFriend = await getUserById(userId)
        let group = await getUserGroupById(groupId)

        if (!addFriend) { return res.status(500).json({ errors: { message: 'Invalid User Id.' } }) };
        if (!group) { return res.status(500).json({ errors: { message: 'Invalid Group Id.' } }) };

        let friend = new Friend();
        friend.user = myUser;
        friend.friend = addFriend;
        friend.group = group;
        friend.status = 'invited';

        await friend.save();

        myUser.friends.push(friend);
        await myUser.save();


        let reqFriend = new Friend();
        reqFriend.user = addFriend;
        reqFriend.friend = myUser;
        reqFriend.status = 'requested';

        await reqFriend.save();

        addFriend.friends.push(reqFriend);
        await addFriend.save();

        return res.status(200).json({ user: addFriend.toProfileJSONFor(addFriend), message: 'Friend requeste sent successfylly.' });
    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/delete-friendship-requset', authenticate, async function (req, res, next) {
    const { id } = req.currentUser
    const { errors, isValid } = deleteFriendshipRequset(req.body)
    if (!isValid) { return res.status(500).json({ errors }) }

    try {

        const { userId } = req.body;

        let user = await getUserById(id)
        let requestedUser = await getUserById(userId)

        if (!requestedUser) {
            return res.status(500).json({ errors: { error: error.toString() }, message: 'User not exist with such UserId.' })
        }
        let userFriendObj = await Friend.findOne({ user: id })
        let requestedUserFriendObj = await Friend.findOne({ user: userId })

        if (!userFriendObj && !requestedUserFriendObj) {
            return res.status(500).json({ errors: { error: error.toString() }, message: 'Friend request objects not exist with given userId.' })
        }

        let friendId = userFriendObj._id;
        let friendId1 = requestedUserFriendObj._id

        await userFriendObj.remove()
        await requestedUserFriendObj.remove()

        await user.removeRequestFriendship(friendId);
        await requestedUser.removeRequestFriendship(friendId1);

        return res.status(200).json({ user: user.toProfileJSONFor(user), message: 'Deleted friend request successfylly.' });

    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});

router.post('/user-friend-list', authenticate, async function (req, res, next) {
    const { id } = req.currentUser;
    const { status } = req.query;

    try {

        var query = {};
        var limit = 20;
        var offset = 0;
        if (typeof req.query.limit !== 'undefined') {
            limit = req.query.limit;
        }
        if (typeof req.query.offset !== 'undefined') {
            offset = req.query.offset;
        }
        if (status) {
            query = { $and: [{ user: id }, { status: status }] }
        }
        if (status === '') {
            query = { user: id }
        }
        Promise.all([
            Friend.find(query)
                .limit(Number(limit))
                .skip(Number(offset))
                .sort({ createdAt: 'desc' })
                .populate('friend')
                .exec(),

            Friend.count(query).exec(),
        ]).then(function (results) {
            var group = results[0];
            var groupCount = results[1];

            if (groupCount == 0) {
                return res.status(200).json({ message: "There is no users " + status + ' list' })
            }

            return res.status(200).json({ group, groupCount })
        })
    } catch (error) {
        return res.status(500).json({ errors: { error: error.toString() }, message: 'Oops, something happen bad while proccessing your requset.' })
    }
});


// get friend request 
// get is friend list

export default router;