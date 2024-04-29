import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Icon,
  Segment,
  Header,
  Breadcrumb,
  Popup,
  Image,
  Button,
} from "semantic-ui-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import { Author, Project, ProjectFileWProjectData } from "../../../types";
import api from "../../../api";
import VisualMode from "../../../components/commons/CommonsCatalog/VisualMode";
import AssetsTable from "../../../components/commons/CommonsCatalog/AssetsTable";
import { useTypedSelector } from "../../../state/hooks";
import InfiniteScroll from "react-infinite-scroll-component";
import FilesManager from "../../../components/FilesManager";
import { truncate } from "fs";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../components/util/HelperFunctions";
import {
  getLibGlyphURL,
  getLibraryName,
} from "../../../components/util/LibraryOptions";

/**
 * Displays a public Project's page in the Commons catalog.
 */
const CommonsProject = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  // Project data
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [project, setProject] = useState<Project | null>(null);
  const [showAssets, setShowAssets] = useState<boolean>(true);

  useEffect(() => {
    loadProject();
  }, [projectID]);

  async function loadProject() {
    try {
      setLoadedData(false);
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.project) {
        throw new Error("Error processing server data.");
      }

      setProject(res.data.project);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }

  /**
   * Update page title when data is available.
   */
  useEffect(() => {
    if (project?.title) {
      document.title = `${project.title} - ${org.name} Commons`;
    }
  }, [project]);

  const handleOpenInConductor = () => {
    if (!project?.projectID) return;

    window.open(`/projects/${project?.projectID}`, "_blank");
  };

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>
              {project?.title ?? "Unknown"}
            </Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={!loadedData} className="">
          <div className="flex flex-row px-1 pb-8">
            <div className="flex flex-col w-1/4 min-h-48 h-fit border shadow-md p-4 rounded-md mr-16">
              <Header as="h1" className="!mb-2 !ml-0.5">
                {project?.projectURL ? (
                  <a
                    href={project?.projectURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateString(project?.title, 75)}
                  </a>
                ) : (
                  truncateString(project?.title ?? "", 75)
                )}
              </Header>
              <p className="mt-2">
                <strong>Description: </strong>
                {project?.description
                  ? project?.description
                  : "No description available."}
              </p>
              <p className="mt-2">
                <Icon name="user" color="blue" className="!mr-2" />
                {project?.principalInvestigators &&
                project?.principalInvestigators.length > 0 ? (
                  project?.principalInvestigators
                    ?.map((p) => `${p.firstName} ${p.lastName}`)
                    .join(", ")
                ) : (
                  <span className="muted-text">No principal investigators</span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="user plus" color="blue" className="!mr-2" />
                {project?.coPrincipalInvestigators &&
                project?.coPrincipalInvestigators.length > 0 ? (
                  project?.coPrincipalInvestigators
                    ?.map((p) => `${p.firstName} ${p.lastName}`)
                    .join(", ")
                ) : (
                  <span className="muted-text">
                    No co-principal investigators
                  </span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="university" color="blue" className="!mr-2" />
                {project?.associatedOrgs &&
                project?.associatedOrgs.length > 0 ? (
                  project?.associatedOrgs.join(", ")
                ) : (
                  <span className="muted-text">
                    No associated organizations
                  </span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="dashboard" color="blue" />{" "}
                {project?.status
                  ? capitalizeFirstLetter(project.status)
                  : "Unknown Status"}
              </p>
              <p className="mt-2">
                <Icon name="clipboard list" color="blue" />{" "}
                {project?.classification
                  ? capitalizeFirstLetter(project.classification)
                  : "Unknown Classification"}
              </p>
              <p className="mt-2">
                <Image
                  src={getLibGlyphURL(project?.libreLibrary)}
                  className="library-glyph"
                />
                {getLibraryName(project?.libreLibrary)}
              </p>
              <Button
                icon="lightning"
                content="View in Conductor"
                color="blue"
                fluid
                onClick={handleOpenInConductor}
                className="!mt-4"
              />
            </div>
            <div className="flex flex-col w-3/4">
              {projectID && showAssets && (
                <div className="flex flex-row ">
                  <FilesManager
                    projectID={projectID}
                    canViewDetails={false}
                    toggleFilesManager={() => setShowAssets(!showAssets)}
                  />
                </div>
              )}
              {projectID && !showAssets && (
                <Segment>
                  <div className="hiddensection">
                    <div className="header-container">
                      <Header as="h3">Assets</Header>
                    </div>
                    <div className="button-container">
                      <Button
                        floated="right"
                        onClick={() => setShowAssets(!showAssets)}
                      >
                        Show
                      </Button>
                    </div>
                  </div>
                </Segment>
              )}
            </div>
          </div>
        </Segment>
      </Segment.Group>
    </div>
  );
};

export default CommonsProject;
