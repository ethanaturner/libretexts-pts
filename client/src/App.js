import './App.css';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

/* React State */
import { UserProvider } from './providers.js';
import { userInitialState, userReducer } from './reducers.js';

/* Utility Routes */
import AnonRoute from './components/util/AnonRoute.js';
import PrivateRoute from './components/util/PrivateRoute.js';

/* Commons */
import HarvestRequest from './components/harvestrequest/HarvestRequest.js';
import Commons from './components/commons/Commons.js';

/* Conductor */
import AccountSettings from './components/auth/AccountSettings.js';
import AdoptionReports from './components/supervisor/AdoptionReports.js';
import Dashboard from './components/dashboard/Dashboard.js';
import ProjectsPortal from './components/projects/ProjectsPortal.js';
import Login from './components/auth/Login.js';
import Navbar from './components/navigation/Navbar.js';
import Search from './components/search/Search.js';
import SupervisorDashboard from './components/supervisor/SupervisorDashboard.js';
import HarvestingCompletedProjects from './components/harvesting/HarvestingCompletedProjects.js';
import HarvestingPortal from './components/harvesting/HarvestingPortal.js';
import HarvestingProjectAddExisting from './components/harvesting/HarvestingProjectAddExisting.js';
import HarvestingProjectDetail from './components/harvesting/HarvestingProjectDetail.js';
import HarvestingProjectEdit from './components/harvesting/HarvestingProjectEdit.js';
import HarvestingTargetAdd from './components/harvesting/targetlist/HarvestingTargetAdd.js';
import HarvestingTargetDetail from './components/harvesting/targetlist/HarvestingTargetDetail.js';
import HarvestingTargetEdit from './components/harvesting/targetlist/HarvestingTargetEdit.js';
import HarvestingTargetlist from './components/harvesting/targetlist/HarvestingTargetlist.js';

/* 404 */
import PageNotFound from './components/util/PageNotFound.js';

/* Global Error Tool */
import ErrorProvider from './components/error/ErrorProvider.js';
import ErrorModal from './components/error/ErrorModal.js';

function App() {

    axios.defaults.baseURL = '/api/v1';
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.post['Content-Type'] = 'application/json';
    axios.defaults.withCredentials = true;
    axios.interceptors.response.use((res) => {
        return res;
    }, (err) => {
        if (err.response !== undefined) {
            if (err.response.status === 401 && err.response.data.tokenExpired === true) {
                window.location.assign('/login?src=tokenexp')
            }
        }
        return Promise.reject(err);
    });

    const Conductor = ({ match }) => {
        return (
            <div className='conductor'>
                <Navbar />
                <Switch>
                    <AnonRoute exact path = '/login' component={Login}/>
                    <PrivateRoute exact path = '/dashboard' component={Dashboard} />
                    <PrivateRoute exact path = '/search' component={Search} />
                    <PrivateRoute exact path = '/projects' component={ProjectsPortal} />

                    <PrivateRoute exact path = '/harvesting' component={HarvestingPortal} />
                        <PrivateRoute exact path = '/harvesting/projects/addexisting' component={HarvestingProjectAddExisting} />
                        <PrivateRoute exact path = '/harvesting/projects/completed' component={HarvestingCompletedProjects} />
                        <PrivateRoute exact path = '/harvesting/projects/:id/edit' component={HarvestingProjectEdit} />
                        <PrivateRoute path = '/harvesting/projects/:id' component={HarvestingProjectDetail} />
                        <PrivateRoute exact path = '/harvesting/targetlist' component={HarvestingTargetlist} />
                        <PrivateRoute exact path = '/harvesting/targetlist/add' component={HarvestingTargetAdd} />
                        <PrivateRoute exact path = '/harvesting/targetlist/:id/edit' component={HarvestingTargetEdit} />
                        <PrivateRoute path = '/harvesting/targetlist/:id' component={HarvestingTargetDetail} />
                    <PrivateRoute exact path = '/account/settings' component={AccountSettings} />
                    <PrivateRoute exact path = '/supervisors' component={SupervisorDashboard} />
                    <PrivateRoute exact path = '/adoptionreports' component={AdoptionReports} />
                    {/* 404 */}
                    <Route component={PageNotFound} />
                </Switch>
            </div>
        )
    };

    return (
        <BrowserRouter>
          <div className='App'>
            <UserProvider initialState={userInitialState} reducer={userReducer}>
                <ErrorProvider>
                    <Switch>
                        {/* Commons Render Tree */}
                        <Route exact path = '/' component={Commons} />
                        <Route exact path = '/catalog' component={Commons} />
                        <Route exact path = '/collections' component={Commons} />
                        <Route exact path = '/book/:id' component={Commons} />
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/adapt' component={Commons} />
                        }
                        {/* Standalone */}
                        {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                            <Route exact path = '/harvestrequest' component={HarvestRequest} />
                        }
                        {/* Conductor and Rest of Render Tree */}
                        <Route component={Conductor} />
                    </Switch>
                    <ErrorModal />
                </ErrorProvider>
            </UserProvider>
          </div>
        </BrowserRouter>
    );
};

export default App;
