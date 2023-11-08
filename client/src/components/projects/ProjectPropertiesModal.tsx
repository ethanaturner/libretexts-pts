import {
  Accordion,
  Button,
  Divider,
  Form,
  Header,
  Icon,
  Modal,
  ModalProps,
  Popup,
  Dropdown,
} from "semantic-ui-react";
import {
  GenericKeyTextValueObj,
  Project,
  ProjectClassification,
  ProjectStatus,
} from "../../types";
import { Controller, useForm } from "react-hook-form";
import useGlobalError from "../error/ErrorHooks";
import { lazy, useEffect, useState } from "react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import {
  classificationOptions,
  statusOptions,
  visibilityOptions,
} from "../util/ProjectHelpers";
import { licenseOptions } from "../util/LicenseOptions";
import api from "../../api";
import axios from "axios";
const DeleteProjectModal = lazy(() => import("./DeleteProjectModal"));

interface ProjectPropertiesModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
}

type CIDDescriptorOption = GenericKeyTextValueObj<string> & {
  content?: JSX.Element;
};

const ProjectPropertiesModal: React.FC<ProjectPropertiesModalProps> = ({
  show,
  onClose,
  projectID,
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();
  const {
    control,
    getValues,
    setValue,
    watch,
    formState,
    reset,
    trigger: triggerValidation,
  } = useForm<Project>({
    defaultValues: {
      title: "",
      tags: [],
      cidDescriptors: [],
      currentProgress: 0,
      peerProgress: 0,
      a11yProgress: 0,
      classification: ProjectClassification.HARVESTING,
      status: ProjectStatus.OPEN,
      visibility: "private",
      projectURL: "",
      adaptURL: "",
      author: "",
      authorEmail: "",
      license: "",
      resourceURL: "",
      notes: "",
      associatedOrgs: [],
    },
  });

  // UI & Data
  const [loading, setLoading] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [tagOptions, setTagOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedTags, setLoadedTags] = useState<boolean>(false);
  const [cidOptions, setCIDOptions] = useState<CIDDescriptorOption[]>([]);
  const [loadedCIDs, setLoadedCIDs] = useState<boolean>(false);
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedOrgs, setLoadedOrgs] = useState<boolean>(false);

  useEffect(() => {
    if (show && projectID) {
      loadProject();
      getTags();
      getCIDDescriptors();
      getOrgs();
    }
  }, [show, projectID]);

  async function loadProject() {
    try {
      setLoading(true);
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      reset(res.data.project);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load existing Project Tags from the server
   * via GET request, then sort, format, and save
   * them to state for use in the Dropdown.
   */
  async function getTags() {
    try {
      setLoadedTags(false);
      const res = await api.getTags();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tags || !Array.isArray(res.data.tags)) {
        throw new Error("Invalid response from server.");
      }

      res.data.tags.sort((tagA, tagB) => {
        var aNorm = String(tagA.title).toLowerCase();
        var bNorm = String(tagB.title).toLowerCase();
        if (aNorm < bNorm) return -1;
        if (aNorm > bNorm) return 1;
        return 0;
      });

      const newTagOptions = res.data.tags.flatMap((t) => {
        return t.title ? { text: t.title, value: t.title, key: t.title } : [];
      });
      setTagOptions(newTagOptions);
      setLoadedTags(true);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  /**
   * Loads C-ID Descriptors from the server, transforms them for use in UI,
   * then saves them to state.
   */
  async function getCIDDescriptors() {
    try {
      setLoadedCIDs(false);
      const res = await api.getCIDDescriptors();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.descriptors || !Array.isArray(res.data.descriptors)) {
        throw new Error("Invalid response from server.");
      }

      const descriptors = [
        { value: "", key: "clear", text: "Clear..." },
        ...res.data.descriptors.map((item) => {
          return {
            value: item.descriptor,
            key: item.descriptor,
            text: `${item.descriptor}: ${item.title}`,
            content: (
              <div>
                <span>
                  <strong>{item.descriptor}</strong>: {item.title}
                </span>
                <p className="mt-05p">
                  <em>{item.description}</em>
                </p>
              </div>
            ),
          };
        }),
      ];
      setCIDOptions(descriptors);
      setLoadedCIDs(true);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function getOrgs() {
    try {
      setLoadedOrgs(false);
      const res = await api.getCentralIdentityOrgs();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server.");
      }

      const orgs = res.data.orgs.map((org) => {
        return {
          value: org.name,
          key: org.id.toString(),
          text: org.name,
        };
      });

      setOrgOptions(orgs);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedOrgs(true);
    }
  }

  /**
   * Ensure the form data is valid, then submit the
   * data to the server via PUT request.
   */
  const submitEditInfoForm = async () => {
    try {
      setLoading(true);
      if (!(await triggerValidation())) {
        throw new Error("Please fix the errors in the form before submitting.");
      }

      const res = await axios.put("/project", getValues());
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onClose();
      return;
    } catch (err) {
      //  if (err.toJSON().status === 409) {
      //      handleGlobalError(
      //        err,
      //        "View Project",
      //        err.response.data.projectID ?? "unknown"
      //      );
      //  }
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={show} closeOnDimmerClick={false} size="fullscreen">
      <Modal.Header>Edit Project Properties</Modal.Header>
      <Modal.Content scrolling>
        <Form noValidate className="flex flex-col">
          <Header as="h3">Project Properties</Header>
          <CtlTextInput
            control={control}
            name="title"
            label="Project Title"
            placeholder="Enter the project title..."
            rules={required}
            required
          />
          <div className="flex flex-row justify-between mt-4">
            <CtlTextInput
              name="currentProgress"
              control={control}
              label="Current Progress"
              placeholder="Enter current estimated progress..."
              type="number"
              min="0"
              max="100"
              className="basis-1/4"
            />
            <CtlTextInput
              name="peerProgress"
              control={control}
              label="Peer Review Progress"
              placeholder="Enter current estimated progress..."
              type="number"
              min="0"
              max="100"
              className="basis-1/4"
            />
            <CtlTextInput
              name="a11yProgress"
              control={control}
              label="Accessibility Progress"
              placeholder="Enter current estimated progress..."
              type="number"
              min="0"
              max="100"
              className="basis-1/4"
            />
          </div>
          <div className="flex flex-row justify-between mt-4">
            <Form.Field>
              <label htmlFor="projectStatus">Status</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="projectStatus"
                    options={statusOptions}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "text");
                    }}
                    fluid
                    selection
                    placeholder="Status..."
                  />
                )}
              />
            </Form.Field>
            <Form.Field>
              <label htmlFor="projectClassification">Classification</label>
              <Controller
                name="classification"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="projectClassification"
                    options={classificationOptions}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "text");
                    }}
                    fluid
                    selection
                    placeholder="Classification..."
                  />
                )}
              />
            </Form.Field>
            <Form.Field>
              <label htmlFor="projectVisibility">Visibility</label>
              <Controller
                name="visibility"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="projectVisibility"
                    options={visibilityOptions}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "text");
                    }}
                    fluid
                    selection
                    placeholder="Visibility..."
                  />
                )}
              />
            </Form.Field>
          </div>
          <Form.Field className="flex flex-col !mt-4">
            <label htmlFor="projectURL">
              <span className="mr-05p">
                Project URL <span className="muted-text">(if applicable)</span>
              </span>
              <Popup
                trigger={<Icon name="info circle" />}
                position="top center"
                content={
                  <span className="text-center">
                    If a LibreText URL is entered, the Library, ID, and
                    Bookshelf or Campus will be automatically retrieved.
                  </span>
                }
              />
            </label>
            <CtlTextInput
              name="projectURL"
              control={control}
              placeholder="Enter project URL..."
              type="url"
              id="projectURL"
            />
          </Form.Field>

          <Form.Field className="flex flex-col">
            <label htmlFor="projectTags">Project Tags</label>
            <Controller
              render={({ field }) => (
                // @ts-expect-error
                <Dropdown
                  id="projectTags"
                  placeholder="Search tags..."
                  options={tagOptions}
                  {...field}
                  onChange={(e, { value }) => {
                    field.onChange(value as string);
                  }}
                  fluid
                  selection
                  multiple
                  search
                  allowAdditions
                  loading={!loadedTags}
                  onAddItem={(e, { value }) => {
                    if (value) {
                      tagOptions.push({
                        text: value.toString(),
                        value: value.toString(),
                        key: value.toString(),
                      });
                      field.onChange([
                        ...(field.value as GenericKeyTextValueObj<string>[]),
                        value.toString(),
                      ]);
                    }
                  }}
                  renderLabel={(tag) => ({
                    color: "blue",
                    content: tag.text,
                  })}
                />
              )}
              name="tags"
              control={control}
            />
          </Form.Field>
          <Form.Field className="flex flex-col !mt-4">
            <label htmlFor="cidinput">
              <span className="mr-05p">
                C-ID <span className="muted-text">(if applicable)</span>
              </span>
              <Popup
                trigger={<Icon name="info circle" />}
                position="top center"
                hoverable={true}
                content={
                  <span className="text-center">
                    {
                      "Use this field if your Project or resource pertains to content for a course registered with the "
                    }
                    <a href="https://c-id.net/" target="_blank" rel="noopener">
                      California Course Identification Numbering System (C-ID)
                    </a>
                    .
                  </span>
                }
              />
            </label>
            <Controller
              name="cidDescriptors"
              control={control}
              render={({ field }) => (
                <Dropdown
                  id="cidinput"
                  control={control}
                  name="cidDescriptors"
                  fluid
                  deburr
                  placeholder="Search C-IDs..."
                  multiple
                  search
                  selection
                  options={cidOptions}
                  loading={!loadedCIDs}
                  disabled={!loadedCIDs}
                  renderLabel={(cid) => ({
                    color: "blue",
                    content: cid.key,
                  })}
                />
              )}
            />
          </Form.Field>
          <Form.Field className="flex flex-col !mt-4">
            <label htmlFor="associatedOrgs">Associated Organizations</label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="associatedOrgs"
                  placeholder="Search organizations..."
                  options={orgOptions}
                  {...field}
                  onChange={(e, { value }) => {
                    field.onChange(value as string);
                  }}
                  fluid
                  selection
                  multiple
                  search
                  allowAdditions
                  loading={!loadedOrgs}
                  onAddItem={(e, { value }) => {
                    if (value) {
                      orgOptions.push({
                        text: value.toString(),
                        value: value.toString(),
                        key: value.toString(),
                      });
                      field.onChange([
                        ...(field.value as string[]),
                        value.toString(),
                      ]);
                    }
                  }}
                  renderLabel={(tag) => ({
                    color: "blue",
                    content: tag.text,
                  })}
                />
              )}
              name="associatedOrgs"
              control={control}
            />
          </Form.Field>
          <p>
            <em>
              For settings and properties related to Peer Reviews, please use
              the Settings tool on this project's Peer Review page.
            </em>
          </p>
          <Divider />
          <Header as="h3">Homework and Assessments</Header>
          <p>
            <em>
              {`Use this section to link your project's Commons page (if applicable) to an `}
              <a
                href="https://adapt.libretexts.org"
                target="_blank"
                rel="noreferrer"
              >
                ADAPT
              </a>
              {` assessment system course. `}
              <strong>Ensure the course allows anonymous users.</strong>
            </em>
          </p>
          <Form.Field>
            <label htmlFor="adaptURL">
              <span className="mr-05p">
                ADAPT Course URL{" "}
                <span className="muted-text">(if applicable)</span>
              </span>
              <Popup
                trigger={<Icon name="info circle" />}
                position="top center"
                content={
                  <span className="text-center">
                    Paste the URL of your Course Dashboard (assignments list) or
                    Course Properties page. The Course ID will be automatically
                    determined.
                  </span>
                }
              />
            </label>
            <CtlTextInput
              name="adaptURL"
              control={control}
              placeholder="Enter ADAPT Course Dashboard URL..."
              type="url"
              id="adaptURL"
            />
          </Form.Field>
          <Divider />
          <Header as="h3">Source Properties</Header>
          <p>
            <em>
              Use this section if your project pertains to a particular resource
              or tool.
            </em>
          </p>
          <div className="flex flex-row justify-between">
            <CtlTextInput
              name="author"
              control={control}
              label="Author"
              placeholder="Enter resource author name..."
              className="basis-1/2 mr-8"
            />
            <CtlTextInput
              name="authorEmail"
              control={control}
              label="Author's Email"
              placeholder="Enter resource author's email..."
              className="basis-1/2"
            />
          </div>
          <div className="flex flex-row justify-between mt-4">
            <Form.Field>
              <label htmlFor="license">License</label>
              <Controller
                name="license"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="license"
                    options={licenseOptions}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "text");
                    }}
                    fluid
                    selection
                    className="mr-8"
                    placeholder="License..."
                  />
                )}
              />
            </Form.Field>
            <CtlTextInput
              name="resourceURL"
              label="Original URL"
              control={control}
              placeholder="Enter resource URL..."
              type="url"
            />
          </div>
          <Divider />
          <Header as="h3">Additional Information</Header>
          <CtlTextArea
            name="notes"
            control={control}
            label="Notes"
            placeholder="Enter additional notes here..."
          />
        </Form>
        <Accordion
          className="mt-2p"
          panels={[
            {
              key: "danger",
              title: {
                content: (
                  <span className="color-semanticred">
                    <strong>Danger Zone</strong>
                  </span>
                ),
              },
              content: {
                content: (
                  <div>
                    <p className="color-semanticred">
                      Use caution with the options in this area!
                    </p>
                    <Button
                      color="red"
                      fluid
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Icon name="trash alternate" />
                      Delete Project
                    </Button>
                  </div>
                ),
              },
            },
          ]}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          icon
          labelPosition="left"
          color="green"
          loading={loading}
          onClick={submitEditInfoForm}
        >
          <Icon name="save" />
          Save Changes
        </Button>
      </Modal.Actions>
      <DeleteProjectModal
        show={showDeleteModal}
        projectID={projectID}
        onCancel={() => setShowDeleteModal(false)}
      />
    </Modal>
  );
};

export default ProjectPropertiesModal;
