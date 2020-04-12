// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
//const firebase = require("firebase/app");

require("firebase/auth");
require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyDFv40o-MFNy4eVfQzLtPG-ATkBUOHPaSI",
    authDomain: "condution-7133f.firebaseapp.com",
    databaseURL: "https://condution-7133f.firebaseio.com",
    projectId: "condution-7133f",
    storageBucket: "condution-7133f.appspot.com",
    messagingSenderId: "544684450810",
    appId: "1:544684450810:web:9b1caf7ed9285890fa3a43"
};

// Initialize Firebase Application
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

async function dbRef(path) {
    // TODO: untested
    let ref = db;
    for (let [key, val] of path.entries()) {
        console.log(`getting doc ${val} from collection ${key}`);

        ref = ref.collection(key);
        if (typeof val === 'string') // get doc
            ref = ref.doc(val);
        else if (Array.isArray(val)) // where clause: use like {task: ['project', '==', '']}
            ref = ref.where(...val);
        else if (typeof val === 'undefined') // wildcard: use like {user: userID, project: undefined}
            break;
    }
    return ref;
}

async function getTasks(userID) {
    // TODO: untested
    return dbRef({users: userID, tasks: undefined}).get()
    .then(snap => snap
        .map(doc => doc.id)
    )
    .catch(err => {
        console.error('Error getting documents', err);
    });
}

async function getInboxTasks(userID) {
    // TODO: untested
    return dbRef({users: userID, tasks: ['project', '==', '']}).get()
    .then(snap => snap
        .filter(doc => !doc.isComplete)
        .map(doc => doc.id)
    ).catch(err => {
        console.error('Error getting documents', err);
    });
}

async function getDSTasks(userID) {
    // TODO: untested
    let dsTime = new Date(); // TODO: merge with next line?
    dsTime.setHours(dsTime.getHours() + 24);
    return dbRef({users: userID, tasks: ['due', '<=', dsTime]}).get()
    .then(snap => snap
        .filter(doc => !doc.isComplete)
    ).catch(console.error);
}

async function getInboxandDS(userID) {
    let ibt = await getInboxTasks(userID);
    let dst = await getDSTasks(userID);
    let dstWithoutIbt = dst.filter(x => ibt.indexOf(x) < 0);
    return [ibt, dstWithoutIbt]
}

async function getTaskInformation(userID, taskID) {
    // TODO: untested
    return (await dbRef({users: userID, tasks: taskID}).get()).data();
}

async function getProjectsAndTags(userID) {
    // TODO: untested
    // NOTE: no longer console.error when  !project/tag.exists
    let projectIdByName = {};
    let projectNameById = {};
    await dbRef({users: userID, projects: undefined}).get()
        .then(snap => snap.forEach(projID => {
            dbRef({users: userID, projects: projID}).get()
                .filter(proj => proj.exists)
                .then(proj => {
                    projectNameById[projID] = proj.data().name;
                    projectIdByName[proj.data().name] = projID;
                })
        }))
        .catch(console.error);

    let tagIdByName = {};
    let tagNameById = {};
    await dbRef({users: userID, tags: undefined}).get()
        .then(snap => snap.forEach(tagID => {
            dbRef({users: userID, tags: tagID}).get()
                .filter(tag => tag.exists)
                .then(tag => {
                    tagNameById[tagID] = tag.data().name;
                    tagIdByName[tag.data().name] = tagID;
                })
        }))
        .catch(console.error);

    return [[projectIdByName, projectNameById], [tagIdByName, tagNameById]];
}

async function modifyTask(userID, taskID, updateQuery) {
    // TODO: untested
    dbRef({users: userID, tasks: taskID}).get()
        .then((doc) => { // TODO: create a doc exists? wrapper
            if (doc.exists !== true)
                throw "excuse me wth, why are you getting me to modify something that does not exist???? *hacker noises*";
        });

    await dbRef({users: userID, tasks: taskID})
        .update(updateQuery)
        .catch(console.error);
}

// -------->8--------

async function newTask(userID, nameParam, descParam, deferParam, dueParam, isFlaggedParam, isFloatingParam, projectParam, tagsParam, tz) { //TODO: task order calculation
    await db.collection("users").doc(userID).collection("tasks").add({
        // TODO: maybe accept a dictionary as a parameter instead of accepting everything as a parameter
        name:nameParam,
        desc:descParam,
        defer:deferParam,
        due:dueParam,
        isFlagged: isFlaggedParam,
        isFloating: isFloatingParam,
        project: projectParam,
        tags: tagsParam,
        timezone: tz,
        isComplete: false
    });
}

async function newTag(userID, tagName) {
    let ntID = await db.collection("users").doc(userID).collection("tags").add({
        name: tagName,
    });
    return ntID.id;
}

async function completeTask(userID, taskID) {
    await db.collection("users").doc(userID).collection("tasks").doc(taskID).get().then(function(doc) {
        if (doc.exists !== true) {
            throw "Document not found. Please don't try to set documents that don't exist.";
        }
    });
    await db.collection("users").doc(userID).collection("tasks").doc(taskID).update({
        isComplete: true
    });
}

async function deleteTask(userID, taskID) {
    db.collection("users").doc(userID).collection("tasks").doc(taskID).delete().then(function() {
        console.log("Task successfully deleted!");
    }).catch(function(error) {
        console.error("Error removing task: ", error);
    });
}

async function deleteProject(userID, projectID) {
    db.collection("users").doc(userID).collection("projects").doc(projectID).delete().then(function() {
        console.log("Project successfully deleted!");
    }).catch(function(error) {
        console.error("Error removing project: ", error);
    });
}

async function deleteTag(userID, tagID) {
    db.collection("users").doc(userID).collection("tag").doc(tagID).delete().then(function() {
        console.log("Tag successfully deleted!");
    }).catch(function(error) {
        console.error("Error removing tag: ", error);
    });
}

async function getProjectStructure(userID, projectID) {
    let children = [];

    await db                                            //  await for processing to finish
    .collection("users").doc(userID)                    //  navigate to this user
    .collection("projects").doc(projectID)              //  navigate to this project
    .collection("children").get()                       //  get the ids of the children of this project
    .then(snapshot => {
        snapshot.forEach(async doc => {                 //  for each child
            if (doc.data().type === "task") {             //      if the child is a task
                let order = (await db.collection("users").doc(userID).collection("tasks").doc(doc.data().childrenID).get()).data().order; //  get the order of the task
                children.push({type: "task", content: doc.data().childrenID, sortOrder: order});   //  push its ID to the array
            } else if (doc.data().type === "project") {    //      if the child is a project
                // push the children of this project---same structure as the return obj of this func
                let order = (await db.collection("users").doc(userID).collection("projects").doc(doc.data().childrenID).get()).data().order; //  get the order of the task
                children.push({type: "project", content: (await getProjectStructure(userID, doc.data().childrenID)), sortOrder: order});
            }
        });
        //  NOTE: returns with `id` prop to preserve id of og project
    }).catch(console.error);
    children.sort((a,b) => a.sortOrder-b.sortOrder); //  sort by ascending order of order
    return { id: projectID, children: children };
}
