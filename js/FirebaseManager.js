
async function getTasks(userID) {
    return cRef("users", userID, "tasks").get()
    .then(snap => snap.docs
        .map(doc => doc.id)
    ).catch(err => {
        console.error('Error getting documents', err);
    });
}

async function getInboxTasks(userID) {
    let inboxDocs = await cRef(
        "users", userID,
        "tasks")
        //['project', '==', ''],
        //['isComplete', "==", false])
        .get()
        .then(snap => snap.docs
            .filter(doc => (doc.data().project === '') && (doc.data().isComplete === false))
            .sort((a,b) => a.data().order - b.data().order)
        ).catch(err => {
            console.error('Error getting documents', err);
        });
    return inboxDocs.map(doc => doc.id);
}

async function getDSTasks(userID) {
    let dsTime = new Date(); // TODO: merge with next line?
    dsTime.setHours(dsTime.getHours() + 24);
    let dsDocs = await cRef("users", userID,
        "tasks")
            //['due', '<=', dsTime],
            //['isComplete', "==", false])
        .get()
        .then(snap => snap.docs
            .filter(doc => (doc.data().due ? (doc.data().due.seconds <= (dsTime.getTime()/1000)) : false) && (doc.data().isComplete === false))
            .sort((a,b) => a.data().due.seconds - b.data().due.seconds)
    ).catch(console.error);
    return dsDocs.map(doc => doc.id);
}

async function getInboxandDS(userID) {
    let ibt = await getInboxTasks(userID);
    let dst = await getDSTasks(userID);
    let dstWithoutIbt = dst.filter(x => ibt.indexOf(x) < 0);
    return [ibt, dstWithoutIbt]
}

async function getTaskInformation(userID, taskID) {
    return (await cRef("users", userID, "tasks").get()
        .then(snap => snap.docs
            .filter(doc => doc.id === taskID))
    )[0].data();
}

async function getTopLevelProjects(userID) {
    let projectIdByName = {};
    let projectNameById = {};

    let snap = (await cRef('users', userID, "projects")
        .get())

    snap.docs.forEach(proj => {
        if (proj.exists && proj.data().top_level === true) {
            projectNameById[proj.id] = proj.data().name;
            projectIdByName[proj.data().name] = proj.id;
        }
    });
    return [projectNameById, projectIdByName];
}

async function getProjectsandTags(userID) {
    // NOTE: no longer console.error when  !project/tag.exists
    let projectIdByName = {};
    let projectNameById = {};
    await cRef("users", userID, "projects").get()   // TODO: combine database hits
        .then(snap => snap.docs.forEach(proj => {
            if (proj.exists) {
                projectNameById[proj.id] = proj.data().name;
                projectIdByName[proj.data().name] = proj.id;
            }
        }))
        .catch(console.error);

    let tagIdByName = {};
    let tagNameById = {};
    await cRef("users", userID, "tags").get()
        .then(snap => snap.docs.forEach(tag => {
            if (tag.exists) {
                tagNameById[tag.id] = tag.data().name;
                tagIdByName[tag.data().name] = tag.id;
            }
        }))
        .catch(console.error);

    return [[projectNameById, projectIdByName], [tagNameById, tagIdByName]];
}

async function modifyTask(userID, taskID, updateQuery) {
    cRef("users", userID, "tasks", taskID).get()
        .then((doc) => { // TODO: create a doc exists? wrapper
            if (doc.exists !== true)
                throw "excuse me wth, why are you getting me to modify something that does not exist???? *hacker noises*";
        });

    //console.log(taskID, updateQuery);
    await cRef("users", userID, "tasks", taskID)
        .update(updateQuery)
        .catch(console.error);
}

async function newTask(userID, taskObj) { 
//, nameParam, descParam, deferParam, dueParam, isFlaggedParam, isFloatingParam, projectParam, tagsParam, tz
    // Set order param. Either return the latest item in index or
    if (taskObj.project === "") {
        let ibtL = (await getInboxTasks(userID)).length;
        taskObj.order = ibtL;
    } else {
        let projL = (await getProjectStructure(userID, taskObj.project)).children.length
        taskObj.order = projL;
    }

    return (await cRef("users", userID, "tasks").add(taskObj)).id;
}

async function newTag(userID, tagName) {
    return cRef("users", userID, "tags").add({name: tagName}).id;
}

async function completeTask(userID, taskID) {
    await cRef("users", userID, "tasks", taskID).get()
        .then(doc => {
            if (doc.exists !== true) {
                throw "Document not found. Please don't try to set documents that don't exist.";
            }
        });
    await cRef("users", userID, "tasks", taskID).update({
            isComplete: true
        });
}

async function deleteTask(userID, taskID) {
    await cRef("users", userID, "tasks", taskID).delete()
        .then(() => {console.log("Task successfully deleted!")})
        .catch(console.error);
}

async function deleteProject(userID, projectID) {
    await cRef("users", userID, "projects", projectID).delete()
        .then(() => {console.log("Project successfully deleted!")})
        .catch(console.error);
}

async function deleteTag(userID, tagID) {
    await cRef("users", userID, "tags", tagID).delete()
        .then(() => {console.log("Tag successfully deleted!")})
        .catch(console.error);
}

async function getProjectStructure(userID, projectID) {
    let children = [];

    await cRef("users", userID, "projects", projectID, "children").get()
        .then(snapshot => {snapshot.docs
                .forEach(async doc => {                 //  for each child
            if (doc.data().type === "task") { // TODO combine these if statements
                let order = (await cRef("users", userID, "tasks", doc.data().childrenID).get()).data().order;//.collection("users").doc(userID).collection("tasks").doc(doc.data().childrenID).get()).data().order; //  get the order of the task // TODO: replace with cRef.get()
                children.push({type: "task", content: doc.data().childrenID, sortOrder: order});   //  push its ID to the array
            } else if (doc.data().type === "project") {    //      if the child is a project
                // push the children of this project---same structure as the return obj of this func
                let order = (await cRef("users", userID, "projects", (doc.data().childrenID)).get()).data().order;//.collection("users").doc(userID).collection("projects").doc(doc.data().childrenID).get()).data().order; //  get the order of theproject // TODO: replace with cRef.get()
                children.push({type: "project", content: (await getProjectStructure(userID, doc.data().childrenID)), sortOrder: order});
            }
        });
        //  NOTE: returns with `id` prop to preserve id of og project
    }).catch(console.error);
    children.sort((a,b) => a.sortOrder-b.sortOrder); //  sort by ascending order of order, TODO: we should prob use https://firebase.google.com/docs/reference/js/firebase.firestore.Query#order-by
    return { id: projectID, children: children };
}
