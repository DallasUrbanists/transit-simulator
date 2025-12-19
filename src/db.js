import { Dexie } from 'dexie';

//
// Declare Database
//
export const db = new Dexie('FriendDatabase');
db.version(1).stores({
    friends: '++id, age'
});

//
// Play with it
//
try {
    await db.friends.add({ name: 'Alice', age: 21 });

    const youngFriends = await db.friends
        .where('age')
        .below(30)
        .toArray();

    console.log(`My young friends: ${JSON.stringify(youngFriends)}`);
} catch (e) {
    console.log(`Oops: ${e}`);
}