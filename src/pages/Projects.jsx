import { IonContent, IonPage, IonSplitPane, IonMenu, IonText, IonIcon, IonMenuButton, IonRouterOutlet, IonMenuToggle, IonBadge, isPlatform } from '@ionic/react';
//import { chevronForwardCircle, checkmarkCircle, filterOutline, listOutline, bicycle } from 'ionicons/icons';
import React, { Component } from 'react';
import './Projects.css';
import './Pages.css';

import ReactTooltip from 'react-tooltip';

import Task from './Components/Task';

import { withRouter } from "react-router";

import Datebar from './Components/Datebar';

const autoBind = require('auto-bind/react'); // autobind things! 

class Projects extends Component { // define the component
    constructor(props) {
        super(props);

        this.state = {
            name: '', // project name
            possibleProjects:{}, // what are the possible projects? 
            possibleTags:{},  // what are the possible tags?
            possibleProjectsRev:{}, 
            possibleTagsRev:{}, 
            availability: [],  // whats available
            projectSelects:[], 
            tagSelects: [], 
            projectDB: {},
            parent: "",
            is_sequential: false,
            currentProject: {children:[]},
            activeTask: ""
        };

        this.updatePrefix = this.random();

        this.props.gruntman.registerRefresher((this.refresh).bind(this));

        this.activeTask = React.createRef();

        this.name = React.createRef();

        autoBind(this);
    }

    componentWillUnmount() {
        this.props.gruntman.halt();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        // flush styles
        if (prevProps.id !== this.props.id) // if we updated the defer date
            this.refresh(); // switching between perspectives are a prop update and not a rerender

        if (prevProps.id !== this.props.id && this.props.options === "do") // if we are trying to create
            this.name.current.focus(); // focus the name
    }

    async refresh() {
        let avail = await this.props.engine.db.getItemAvailability(this.props.uid) // get availability of items
        let pPandT = await this.props.engine.db.getProjectsandTags(this.props.uid); // get projects and tags

        let projectList = []; // define the project list
        let tagsList = []; // define the tag list

        for (let pid in pPandT[1][0]) 
            tagsList.push({value: pid, label: pPandT[1][0][pid]});
        let views = this;
        let projectDB = await (async function() {
            let pdb = [];
            let topLevels = (await views.props.engine.db.getTopLevelProjects(views.props.uid))[0];
            for (let key in topLevels) {
                pdb.push(await views.props.engine.db.getProjectStructure(views.props.uid, key, true));
            }
            return pdb;
        }());

        let buildSelectString = function(p, level) {
            if (!level)
                level = ""
            projectList.push({value: p.id, label: level+pPandT[0][0][p.id]})
            if (p.children)
                for (let e of p.children)
                    if (e.type === "project")
                        buildSelectString(e.content, level+":: ");
        };
        projectDB.map(proj=>buildSelectString(proj));
        this.updatePrefix = this.random();
        let cProject = (await views.props.engine.db.getProjectStructure(this.props.uid, this.props.id, false));
        this.setState({name:pPandT[0][0][this.props.id], possibleProjects: pPandT[0][0], possibleTags: pPandT[1][0], possibleProjectsRev: pPandT[0][1], possibleTagsRev: pPandT[1][1], availability: avail, projectSelects: projectList, tagSelects: tagsList, projectDB, currentProject: cProject, is_sequential: cProject.is_sequential, parent: cProject.parentProj});
    }

    componentDidMount() {
        this.refresh();
        if (this.props.options === "do") // if we are trying to create
            this.name.current.focus(); // focus the name
    }

    random() { return (((1+Math.random())*0x10000)|0).toString(16)+"-"+(((1+Math.random())*0x10000)|0).toString(16);}

    updateName(e) {
        if (e) {
            this.props.gruntman.registerScheduler(() => { 
                // Register a scheduler to deal with React's onChange
                // check out the FANCYCHANGE in task.jsx
                this.props.gruntman.do( // call a gruntman function
                    "project.update__name", { 
                        uid: this.props.uid, // pass it the things vvv
                        id: this.props.id, 
                        name: e.target.value
                    }
                ).then(this.props.menuRefresh) // call the homebar refresh
            }, `project.this.${this.props.id}-update`) // give it a custom id
            this.setState({name: e.target.value})
        } else { console.log(e)}
    } 

    render() {
        return (
            <IonPage>
                <div className={"page-invis-drag " + (()=>{
                    if (!isPlatform("electron")) // if we are not running electron
                        return "normal"; // normal windowing proceeds
                    else if (window.navigator.platform.includes("Mac")){ // macos
                        return "darwin"; // frameless setup
                    }
                    else if (process.platform === "win32") // windows
                        return "windows"; // non-frameless

                })()}>&nbsp;</div>
                <div className={"page-content " + (()=>{
                    if (!isPlatform("electron")) // if we are not running electron
                        return "normal"; // normal windowing proceeds
                    else if (window.navigator.platform.includes("Mac")){ // macos
                        return "darwin"; // frameless setup
                    }
                    else if (process.platform === "win32") // windows
                        return "windows"; // non-frameless

                })()}>

                    <div className="header-container" >
                        <div style={{display: "inline-block"}}>
                            <div> 
                                <IonMenuToggle>
                                    <i className="fas fa-bars" 
                                        style={{marginLeft: 20, color: "var(--decorative-light-alt"}} />
                                </IonMenuToggle> 
                                <h1 className="page-title">
                                    {(()=> {
                                        if (this.state.parent !== "")
                                            return <a className="fas fa-chevron-left backbutton" onClick={()=>{this.props.paginate("projects", this.state.parent);this.props.history.push(`/projects/${this.state.parent}`)}} />
                                    })()}
                                    <i style={{paddingRight: 4}} 
                                        className="fas fa-tasks">
                                    </i>
                                    <input className="editable-title" 
                                        onChange={(e)=> {e.persist(); this.updateName(e)}}
                                        value={this.state.name} // TODO: jack this is hecka hacky
                                        style={{transform: "transformY(-2px)"}}
                                        ref={this.name}
                                    />
                                </h1> 
                                <ReactTooltip effect="solid" offset={{top: 3}} backgroundColor="black" className="tooltips" />
                                <div className="greeting-container" style={{marginLeft: 5, marginTop: 7}}>
                                    <a 
                                        onClick={()=> {
                                            this.setState({is_sequential: !this.state.currentProject.is_sequential}, () => {
                                                this.props.gruntman.do( // call a gruntman function
                                                    "project.update__pstate", { 
                                                        uid: this.props.uid, // pass it the things vvv
                                                        id: this.props.id, 
                                                        is_sequential: this.state.is_sequential
                                                    }
                                                );
                                            }); // change the icon
                                        }} 
                                        data-tip="LOCALIZE: Sequencial/Paralellel"
                                        className="perspective-icon" 
                                        style={{borderColor: "var(--task-checkbox-feature-alt)", 
                                            cursor: "pointer", marginLeft: 5}}>
                                        <i className={this.state.is_sequential ? "fas fa-arrows-alt-v":"fas fa-arrows-alt-h"}
                                            style={{margin: 3, color: "var(--task-textbox)", 
                                                fontSize: 13, transform: this.state.is_sequential ? "translate(3.5px, -1px)" : "translate(0.25px, -1px)"}}>
                                        </i>
                                    </a>
                                    <a 
                                        data-tip="LOCALIZE: Delete"
                                        className="perspective-icon" 
                                        onClick={()=>{
                                            this.props.gruntman.do( // call a gruntman function
                                                "project.delete", { 
                                                    uid: this.props.uid, // pass it the things vvv
                                                    pid: this.props.id, 
                                                    parent: (this.state.parent === "" || this.state.parent === undefined) ? undefined : this.state.parent
                                                }
                                            ).then(()=>{
                                                this.props.menuRefresh(); // refresh menubar
                                                this.props.history.push((this.state.parent === "" || this.state.parent === undefined) ? "/upcoming/" : `/projects/${this.state.parent}`); // go back
                                                this.props.paginate((this.state.parent === "" || this.state.parent === undefined) ? "upcoming" : `projects`, (this.state.parent === "" || this.state.parent === undefined) ? undefined : this.state.parent);
                                            }) // call the homebar refresh
                                        }}
                                        style={{borderColor: "var(--task-checkbox-feature-alt)", 
                                            cursor: "pointer", marginLeft: 5}}>
                                        <i className="fas fa-trash"
                                            style={{margin: 3, color: "var(--task-textbox)", 
                                                fontSize: 10, transform: "translate(2px, -2px)"}}
                                        >
                                        </i>
                                    </a>

                                </div> 
                            </div>
                        </div>
                    </div>

                    <div style={{marginLeft: 10, marginRight: 10, overflowY: "scroll"}}>
                        {this.state.currentProject.children.map(item => {
                            if (item.type === "task")
                                return (
                                    <Task 
                                        tid={item.content}
                                        key={item.content+"-"+this.updatePrefix} 
                                        uid={this.props.uid} 
                                        engine={this.props.engine} 
                                        gruntman={this.props.gruntman} 
                                        availability={this.state.availability[item.content]} 
                                        startOpen={this.state.activeTask === item.content}
                                        ref={this.state.activeTask===item.content ? this.activeTask : undefined}
                                        datapack={[
                                            this.state.tagSelects, 
                                            this.state.projectSelects, 
                                            this.state.possibleProjects, 
                                            this.state.possibleProjectsRev, 
                                            this.state.possibleTags, 
                                            this.state.possibleTagsRev
                                        ]}
                                    />
                                )
                            else if (item.type === "project")
                                return (
                                    <a className="subproject" style={{opacity:this.state.availability[item.content.id]?"1":"0.35"}} onClick={()=>{this.props.paginate("projects", item.content.id);this.props.history.push(`/projects/${item.content.id}`)}}><div><i className="far fa-arrow-alt-circle-right subproject-icon"/><div style={{display: "inline-block"}}>{this.state.possibleProjects[item.content.id]}</div></div></a>
                                )
                        })}
                        <div style={{marginTop: 10}}>
                            <a className="newbutton" onClick={()=>{
                                this.props.gruntman.do( // call a gruntman function
                                    "task.create", { 
                                        uid: this.props.uid, // pass it the things vvv
                                        pid: this.props.id, 
                                    },
                                    true // bypass updates to manually do it + make it quicker
                                ).then((result)=>{
                                    let cProject = this.state.currentProject; // get current project
                                    let avail = this.state.availability; // get current availibilty
                                    avail[result.tid] = true; // set the current one to be available, temporarily so that people could write in it
                                    cProject.children.push({type: "task", content:result.tid}); // add our new task
                                    this.setState({activeTask:result.tid, currentProject: cProject, availability: avail}, () =>  this.activeTask.current._explode() ) // wosh!
                                }) // call the homebar refresh
                            }}><div><i className="fas fa-plus-circle subproject-icon"/><div style={{display: "inline-block", fontWeight: 500}}>Add a Task</div></div></a>
                            <a className="newbutton" onClick={async function() {
                                let npid = (await this.props.gruntman.do( // call a gruntman function
                                    "project.create", { 
                                        uid: this.props.uid, // pass it the things vvv
                                        parent: this.props.id, 
                                    },
                                )).pid;
                                this.props.history.push(`/projects/${npid}/do`);
                            }.bind(this)}><div><i className="fas fa-plus-circle subproject-icon"/><div style={{display: "inline-block", fontWeight: 500}}>Add a Project</div></div></a>
                            <div className="bottom-helper">&nbsp;</div>
                        </div>
                    </div>
                </div>

            </IonPage>
        )
    }
}

export default withRouter(Projects);

