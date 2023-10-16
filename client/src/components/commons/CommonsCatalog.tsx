import "./Commons.css";

import { Link } from "react-router-dom";
import {
  Grid,
  Image,
  Dropdown,
  Segment,
  Table,
  Header,
  Icon,
  Button,
  Form,
  PaginationProps,
  Checkbox,
} from "semantic-ui-react";
import { useEffect, useState, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import { useLocation, useHistory } from "react-router-dom";
import Breakpoint from "../util/Breakpoints";
import ConductorPagination from "../util/ConductorPagination";
import axios from "axios";
import queryString from "query-string";
import {
  libraryOptions,
  getLibGlyphURL,
  getLibGlyphAltText,
} from "../util/LibraryOptions.js";
import { licenseOptions } from "../util/LicenseOptions.js";
import useGlobalError from "../error/ErrorHooks";
import { catalogItemsPerPageOptions } from "../util/PaginationOptions.js";
import { catalogDisplayOptions } from "../util/CatalogOptions";
import { updateParams, isEmptyString } from "../util/HelperFunctions.js";
import { ResultsText } from "../util/ConductorPagination";
import { Book, CatalogLocation, GenericKeyTextValueObj } from "../../types";
import { isCatalogLocation } from "../../utils/typeHelpers";
import { sanitizeCustomColor } from "../../utils/campusSettingsHelpers";
import CatalogCard from "./CommonsCatalog/CatalogCard";

const CommonsCatalog = () => {
  const { handleGlobalError } = useGlobalError();

  // Global State and Location/History
  const location = useLocation();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  // Data
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [pageBooks, setPageBooks] = useState<Book[]>([]);
  const [numResultBooks, setNumResultBooks] = useState<number>(0);
  const [numTotalBooks, setNumTotalBooks] = useState<number>(0);

  /** UI **/
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [loadedData, setLoadedData] = useState<boolean>(false);

  const [loadedFilters, setLoadedFilters] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const initialSearch = useRef(true);
  const checkedParams = useRef(false);

  // Content Filters
  type FilterParams = {
    sort: string;
    search?: string;
    library?: string;
    subject?: string;
    location?: string;
    author?: string;
    license?: string;
    affiliation?: string;
    course?: string;
    publisher?: string;
    cidDescriptor?: string;
  };
  const [searchString, setSearchString] = useState<string>("");
  const [libraryFilter, setLibraryFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<CatalogLocation>(
    org.orgID === "libretexts" ? "all" : "campus"
  );
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [authorFilter, setAuthorFilter] = useState<string>("");
  const [licenseFilter, setLicenseFilter] = useState<string>("");
  const [affilFilter, setAffilFilter] = useState<string>("");
  const [instrFilter, setInstrFilter] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [pubFilter, setPubFilter] = useState<string>("");
  const [cidFilter, setCIDFilter] = useState<string>("");
  const [includeCentral, setIncludeCentral] = useState<boolean>(
    org.orgID === "libretexts" ? true : false
  );
  const [includeCampus, setIncludeCampus] = useState<boolean>(true);

  const [subjectOptions, setSubjectOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [authorOptions, setAuthorOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [affOptions, setAffOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [courseOptions, setCourseOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pubOptions, setPubOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [cidOptions, setCIDOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);

  // Sort and Search Filters
  const [sortChoice, setSortChoice] = useState("random");
  const [displayChoice, setDisplayChoice] = useState("visual");

  const sortOptions = [
    { key: "random", text: "Sort by...", value: "random" },
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
  ];

  /**
   * Get filter options from server
   * on initial load.
   */
  useEffect(() => {
    getFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Update the page title based on
   * Organization information.
   */
  useEffect(() => {
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | Catalog`;
    } else {
      document.title = "LibreCommons | Catalog";
    }
  }, [org]);

  useEffect(() => {
    if (includeCampus && includeCentral) {
      setLocationFilter("all");
    } else if (includeCampus && !includeCentral) {
      setLocationFilter("campus");
    } else if (!includeCampus && includeCentral) {
      setLocationFilter("central");
    } else {
      //Fallback to all if both are unchecked
      setIncludeCampus(true);
      setIncludeCentral(true);
      setLocationFilter("all");
    }
  }, [includeCampus, includeCentral]);

  /**
   * Watch selected locations and automatically re-search
   */
  useEffect(() => {
    performSearch();
  }, [locationFilter]);

  /**
   * Build the new search URL and push it onto the history stack.
   * Change to location triggers the network request to fetch results.
   */
  const performSearch = () => {
    let sort = sortChoice;
    if (!initialSearch.current) {
      initialSearch.current = true;
      /* change to ordered on first search */
      if (sort !== "title" && sort !== "author") {
        sort = "title";
      }
    }
    let searchURL = location.search;
    searchURL = updateParams(searchURL, "search", searchString);
    searchURL = updateParams(searchURL, "library", libraryFilter);
    searchURL = updateParams(searchURL, "subject", subjectFilter);
    searchURL = updateParams(searchURL, "location", locationFilter);
    searchURL = updateParams(searchURL, "author", authorFilter);
    searchURL = updateParams(searchURL, "license", licenseFilter);
    searchURL = updateParams(searchURL, "affiliation", affilFilter);
    searchURL = updateParams(searchURL, "course", courseFilter);
    searchURL = updateParams(searchURL, "publisher", pubFilter);
    searchURL = updateParams(searchURL, "cid", cidFilter);
    searchURL = updateParams(searchURL, "sort", sort);
    history.push({
      pathname: location.pathname,
      search: searchURL,
    });
  };

  const resetSearch = () => {
    setSearchString("");
    setLibraryFilter("");
    setSubjectFilter("");
    setLocationFilter(org.orgID === "libretexts" ? "all" : "campus");
    setAuthorFilter("");
    setLicenseFilter("");
    setAffilFilter("");
    setCourseFilter("");
    setPubFilter("");
    setCIDFilter("");
    let searchURL = location.search;
    searchURL = updateParams(searchURL, "search", "");
    searchURL = updateParams(searchURL, "library", "");
    searchURL = updateParams(searchURL, "subject", "");
    searchURL = updateParams(searchURL, "location", "");
    searchURL = updateParams(searchURL, "author", "");
    searchURL = updateParams(searchURL, "license", "");
    searchURL = updateParams(searchURL, "affiliation", "");
    searchURL = updateParams(searchURL, "course", "");
    searchURL = updateParams(searchURL, "publisher", "");
    searchURL = updateParams(searchURL, "cid", "");
    history.push({
      pathname: location.pathname,
      search: searchURL,
    });
  };

  /**
   * Perform GET request for books
   * and update catalogBooks.
   */
  const searchCommonsCatalog = async () => {
    try {
      setLoadedData(false);
      let paramsObj: FilterParams = {
        sort: sortChoice,
      };
      if (!isEmptyString(searchString)) {
        paramsObj.search = searchString;
      }
      if (!isEmptyString(libraryFilter)) {
        paramsObj.library = libraryFilter;
      }
      if (!isEmptyString(subjectFilter)) {
        paramsObj.subject = subjectFilter;
      }
      if (!isEmptyString(locationFilter)) {
        paramsObj.location = locationFilter;
      }
      if (!isEmptyString(authorFilter)) {
        paramsObj.author = authorFilter;
      }
      if (!isEmptyString(licenseFilter)) {
        paramsObj.license = licenseFilter;
      }
      if (!isEmptyString(affilFilter)) {
        paramsObj.affiliation = affilFilter;
      }
      if (!isEmptyString(courseFilter)) {
        paramsObj.course = courseFilter;
      }
      if (!isEmptyString(pubFilter)) {
        paramsObj.publisher = pubFilter;
      }
      if (!isEmptyString(cidFilter)) {
        paramsObj.cidDescriptor = cidFilter;
      }

      const res = await axios.get("/commons/catalog", {
        params: paramsObj,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      
      if (Array.isArray(res.data.books)) {
        setCatalogBooks(res.data.books);
      }
      if (typeof res.data.numFound === "number") {
        setNumResultBooks(res.data.numFound);
      }
      if (typeof res.data.numTotal === "number") {
        setNumTotalBooks(res.data.numTotal);
      }
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    } finally {
      setLoadedData(true);
    }
  };

  /**
   * Retrieve the list(s) of dynamic
   * filter options from the server.
   */
  const getFilterOptions = async () => {
    try {
      const res = await axios.get("/commons/filters");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      const newAuthorOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newSubjectOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newAffOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newCourseOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newPubOptions = [{ key: "empty", text: "Clear...", value: "" }];
      const newCIDOptions = [{ key: "empty", text: "Clear...", value: "" }];

      if (res.data.authors && Array.isArray(res.data.authors)) {
        res.data.authors.forEach((author: string) => {
          newAuthorOptions.push({
            key: author,
            text: author,
            value: author,
          });
        });
      }
      if (res.data.subjects && Array.isArray(res.data.subjects)) {
        res.data.subjects.forEach((subject: string) => {
          newSubjectOptions.push({
            key: subject,
            text: subject,
            value: subject,
          });
        });
      }
      if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
        res.data.affiliations.forEach((affiliation: string) => {
          newAffOptions.push({
            key: affiliation,
            text: affiliation,
            value: affiliation,
          });
        });
      }
      if (res.data.courses && Array.isArray(res.data.courses)) {
        res.data.courses.forEach((course: string) => {
          newCourseOptions.push({
            key: course,
            text: course,
            value: course,
          });
        });
      }
      if (res.data.publishers && Array.isArray(res.data.publishers)) {
        res.data.publishers.forEach((publisher: string) => {
          newPubOptions.push({
            key: publisher,
            text: publisher,
            value: publisher,
          });
        });
      }
      if (Array.isArray(res.data.cids)) {
        res.data.cids.forEach((descriptor: string) => {
          newCIDOptions.push({
            key: descriptor,
            text: descriptor,
            value: descriptor,
          });
        });
      }

      setAuthorOptions(newAuthorOptions);
      setSubjectOptions(newSubjectOptions);
      setAffOptions(newAffOptions);
      setCourseOptions(newCourseOptions);
      setPubOptions(newPubOptions);
      setCIDOptions(newCIDOptions);
    } catch (err) {
      handleGlobalError(err);
      setLoadedFilters(true);
    } finally {
      setLoadedFilters(true);
    }
  };

  /**
   * Perform the Catalog search based on
   * URL query change after ensuring the
   * initial URL params sync has been
   * performed.
   */
  useEffect(() => {
    if (checkedParams.current) {
      searchCommonsCatalog();
    }
  }, [checkedParams.current, location.search]);

  /**
   * Update the URL query with the sort choice
   * AFTER a search has been performed and a
   * change has been made.
   */
  useEffect(() => {
    if (initialSearch.current) {
      const searchURL = updateParams(location.search, "sort", sortChoice);
      history.push({
        pathname: location.pathname,
        search: searchURL,
      });
    }
  }, [sortChoice]);

  /**
   * Update the URL query with the display mode
   * AFTER a search has been performed and a
   * change has been made.
   */
  useEffect(() => {
    if (initialSearch.current) {
      const searchURL = updateParams(location.search, "mode", displayChoice);
      history.push({
        pathname: location.pathname,
        search: searchURL,
      });
    }
  }, [displayChoice]);

  /**
   * Track changes to the number of books loaded
   * and the selected itemsPerPage and update the
   * set of books to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(catalogBooks.length / itemsPerPage));
    setPageBooks(
      catalogBooks.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, catalogBooks, activePage]);

  /**
   * Subscribe to changes in the URL search string
   * and update state accordingly.
   */
  useEffect(() => {
    let params = queryString.parse(location.search);
    if (Object.keys(params).length > 0 && !initialSearch.current) {
      // enable results for those entering a direct search URL
      initialSearch.current = true;
    }
    if (params.mode && params.mode !== displayChoice) {
      if (params.mode === "visual" || params.mode === "itemized") {
        setDisplayChoice(params.mode);
      }
    }
    if (
      params.items &&
      typeof params.items === "number" &&
      parseInt(params.items) !== itemsPerPage
    ) {
      if (!isNaN(parseInt(params.items))) {
        setItemsPerPage(params.items);
      }
    }
    if (
      params.search !== undefined &&
      params.search !== searchString &&
      typeof params.search === "string"
    ) {
      setSearchString(params.search);
    }
    if (
      params.sort !== undefined &&
      params.sort !== sortChoice &&
      typeof params.sort === "string"
    ) {
      setSortChoice(params.sort);
    }
    if (
      params.library !== undefined &&
      params.library !== libraryFilter &&
      typeof params.library === "string"
    ) {
      setLibraryFilter(params.library);
    }
    if (
      params.subject !== undefined &&
      params.subject !== subjectFilter &&
      typeof params.subject === "string"
    ) {
      setSubjectFilter(params.subject);
    }
    if (
      params.location !== undefined &&
      params.location !== locationFilter &&
      typeof params.location === "string" &&
      isCatalogLocation(params.location)
    ) {
      if (params.location === "all") {
        setIncludeCampus(true);
        setIncludeCentral(true);
      } else if (params.location === "campus") {
        setIncludeCampus(true);
        setIncludeCentral(false);
      } else if (params.location === "central") {
        setIncludeCampus(false);
        setIncludeCentral(true);
      } else {
        setIncludeCampus(false);
        setIncludeCentral(false);
      }
      setLocationFilter(params.location);
    }
    if (
      params.license !== undefined &&
      params.license !== licenseFilter &&
      typeof params.license === "string"
    ) {
      setLicenseFilter(params.license);
    }
    if (
      params.author !== undefined &&
      params.author !== authorFilter &&
      typeof params.author === "string"
    ) {
      setAuthorFilter(params.author);
    }
    if (
      params.affiliation !== undefined &&
      params.affiliation !== affilFilter &&
      typeof params.affiliation === "string"
    ) {
      setAffilFilter(params.affiliation);
    }
    if (
      params.course !== undefined &&
      params.course !== courseFilter &&
      typeof params.course === "string"
    ) {
      setCourseFilter(params.course);
    }
    if (
      params.publisher !== undefined &&
      params.publisher !== pubFilter &&
      typeof params.publisher === "string"
    ) {
      setPubFilter(params.publisher);
    }
    if (
      params.cid !== undefined &&
      params.cid !== cidFilter &&
      typeof params.cid === "string"
    ) {
      setCIDFilter(params.cid);
    }
    if (!checkedParams.current) {
      // set the initial URL params sync to complete
      checkedParams.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  /**
   * Updates the Active Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   */
  function handleActivePageChange(_e: any, data: PaginationProps) {
    if (data.activePage && typeof data.activePage === "number") {
      return setActivePage(data.activePage);
    }
    setActivePage(1);
  }

  const VisualMode = () => {
    if (pageBooks.length > 0) {
      return (
        <div className="commons-content-card-grid">
          {pageBooks.map((item, index) => (
            <CatalogCard book={item} key={index} />
          ))}
        </div>
      );
    } else {
      return (
        <p className="text-center mt-2e mb-2e">
          <em>No results found.</em>
        </p>
      );
    }
  };

  const ItemizedMode = () => {
    return (
      <Table celled title="Search Results">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell scope="col">
              <Image
                centered
                src={getLibGlyphURL("")}
                className="commons-itemized-glyph"
                alt={getLibGlyphAltText("")}
              />
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Title</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Subject</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Author</Header>
            </Table.HeaderCell>
            <Table.HeaderCell scope="col">
              <Header sub>Affiliation</Header>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {pageBooks.length > 0 &&
            pageBooks.map((item, index) => {
              return (
                <Table.Row key={index}>
                  <Table.Cell>
                    <Image
                      centered
                      src={getLibGlyphURL(item.library)}
                      className="commons-itemized-glyph"
                      alt={getLibGlyphAltText(item.library)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <p>
                      <strong>
                        <Link to={`/book/${item.bookID}`}>{item.title}</Link>
                      </strong>
                    </p>
                  </Table.Cell>
                  <Table.Cell>
                    <p>{item.subject}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p>{item.author}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p>
                      <em>{item.affiliation}</em>
                    </p>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          {pageBooks.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={5}>
                <p className="text-center">
                  <em>No results found.</em>
                </p>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    );
  };

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            {((org.commonsHeader && org.commonsHeader !== "") ||
              (org.commonsMessage && org.commonsMessage !== "")) && (
              <Segment padded>
                <Breakpoint name="desktop">
                  {org.commonsHeader && org.commonsHeader !== "" && (
                    <Header id="commons-intro-header" as="h2">
                      {org.commonsHeader}
                    </Header>
                  )}
                  <p id="commons-intro-message">{org.commonsMessage}</p>
                </Breakpoint>
                <Breakpoint name="mobileOrTablet">
                  {org.commonsHeader && org.commonsHeader !== "" && (
                    <Header
                      id="commons-intro-header"
                      textAlign="center"
                      as="h2"
                    >
                      {org.commonsHeader}
                    </Header>
                  )}
                  <p id="commons-intro-message" className="text-center">
                    {org.commonsMessage}
                  </p>
                </Breakpoint>
              </Segment>
            )}
            <Segment>
              <div id="commons-searchbar-container">
                <Form onSubmit={performSearch}>
                  <Form.Input
                    icon="search"
                    placeholder="Search..."
                    className="color-libreblue"
                    id="commons-search-input"
                    iconPosition="left"
                    onChange={(e) => {
                      setSearchString(e.target.value);
                    }}
                    fluid
                    value={searchString}
                    aria-label="Search query"
                  />
                </Form>
              </div>
              <div id="commons-searchbtns-container">
                <Button
                  fluid
                  id="commons-search-button"
                  onClick={performSearch}
                  style={
                    org.orgID !== "libretexts" && org.primaryColor
                      ? {
                          backgroundColor: sanitizeCustomColor(
                            org.primaryColor
                          ),
                        }
                      : {}
                  }
                  className={
                    org.orgID === "libretexts" || !org.primaryColor
                      ? "commons-search-button-bg"
                      : ""
                  }
                >
                  Search Catalog
                </Button>
                {initialSearch.current && (
                  <Button fluid id="commons-reset-button" onClick={resetSearch}>
                    Clear
                  </Button>
                )}
                <button
                  id="commons-advancedsrch-button"
                  onClick={() => {
                    setShowFilters(!showFilters);
                  }}
                >
                  <Icon name={showFilters ? "caret down" : "caret right"} />
                  <span>Advanced Search</span>
                  <Icon name={showFilters ? "caret down" : "caret left"} />
                </button>
              </div>
              <div
                id="commons-advancedsrch-container"
                className={
                  showFilters
                    ? "commons-advancedsrch-show"
                    : "commons-advancedsrch-hide"
                }
              >
                <div
                  id="commons-advancedsrch-row1"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Library"
                    floating
                    selection
                    button
                    options={libraryOptions}
                    onChange={(_e, { value }) => {
                      setLibraryFilter(value as string);
                    }}
                    value={libraryFilter}
                    className="commons-filter"
                    aria-label="Library filter"
                  />
                  <Dropdown
                    placeholder="Subject"
                    floating
                    search
                    selection
                    button
                    options={subjectOptions}
                    onChange={(_e, { value }) => {
                      setSubjectFilter(value as string);
                    }}
                    value={subjectFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Author"
                    floating
                    search
                    selection
                    button
                    options={authorOptions}
                    onChange={(_e, { value }) => {
                      setAuthorFilter(value as string);
                    }}
                    value={authorFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                <div
                  id="commons-advancedsrch-row2"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Affiliation"
                    floating
                    search
                    selection
                    button
                    options={affOptions}
                    onChange={(_e, { value }) => {
                      setAffilFilter(value as string);
                    }}
                    value={affilFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="License"
                    floating
                    selection
                    button
                    options={licenseOptions}
                    onChange={(_e, { value }) => {
                      setLicenseFilter(value as string);
                    }}
                    value={licenseFilter}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Instructor/Remixer"
                    floating
                    search
                    selection
                    button
                    options={[]}
                    onChange={(_e, { value }) => {
                      setInstrFilter(value as string);
                    }}
                    value={instrFilter}
                    disabled
                    tabIndex={-1}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                <div
                  id="commons-advancedsrch-row3"
                  className="commons-advancedsrch-row"
                >
                  <Dropdown
                    placeholder="Campus or Course"
                    floating
                    search
                    selection
                    button
                    options={courseOptions}
                    onChange={(_e, { value }) => {
                      setCourseFilter(value as string);
                    }}
                    value={courseFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="Publisher"
                    floating
                    search
                    selection
                    button
                    options={pubOptions}
                    onChange={(_e, { value }) => {
                      setPubFilter(value as string);
                    }}
                    value={pubFilter}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                  <Dropdown
                    placeholder="C-ID"
                    floating
                    search
                    selection
                    button
                    options={cidOptions}
                    onChange={(_e, { value }) => setCIDFilter(value as string)}
                    value={cidFilter}
                    tabIndex={-1}
                    loading={!loadedFilters}
                    className="commons-filter"
                  />
                </div>
                {!includeCampus && !includeCentral && (
                  <div
                    id="commons-advancedsrch-row6"
                    className="commons-advancedsrch-row mt-1r"
                  >
                    <p style={{ fontStyle: "italic" }}>
                      No bookshelves selected. All bookshelves will be included
                      by default.
                    </p>
                  </div>
                )}
              </div>
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="mt-05p mb-05p flex-row-div">
                  <p className="mr-1p">Search Locations: </p>
                  <Checkbox
                    label="Central Bookshelves"
                    checked={includeCentral}
                    onChange={(e, data) =>
                      setIncludeCentral(data.checked ?? true)
                    }
                  />
                  <Checkbox
                    className="ml-2r"
                    label="Campus Bookshelves"
                    checked={includeCampus}
                    onChange={(e, data) =>
                      setIncludeCampus(data.checked ?? true)
                    }
                  />
                </div>
                <div className="commons-content-pagemenu">
                  <div className="commons-content-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="commons-content-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText
                      resultsCount={numResultBooks}
                      totalCount={numTotalBooks}
                    />
                  </div>
                  <div className="commons-content-pagemenu-center">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={handleActivePageChange}
                      size="large"
                      siblingRange={0}
                    />
                  </div>
                  <div className="commons-content-pagemenu-right">
                    <Dropdown
                      placeholder="Sort by..."
                      floating
                      selection
                      button
                      options={sortOptions}
                      onChange={(_e, { value }) => {
                        setSortChoice(value as string);
                      }}
                      value={sortChoice}
                      aria-label="Sort results by"
                    />
                    <Dropdown
                      placeholder="Display mode..."
                      floating
                      selection
                      button
                      options={catalogDisplayOptions}
                      onChange={(_e, { value }) => {
                        setDisplayChoice(value as string);
                      }}
                      value={displayChoice}
                      aria-label="Set results display mode"
                    />
                  </div>
                </div>
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <div className="center-flex flex-wrap">
                        <p className="mr-1p">Search Locations: </p>
                        <div className="mb-2r flex-row-div px-auto">
                          <Checkbox
                            label="Central Bookshelves"
                            checked={includeCentral}
                            onChange={(e, data) =>
                              setIncludeCentral(data.checked ?? true)
                            }
                          />
                          <Checkbox
                            className="ml-2r"
                            label="Campus Bookshelves"
                            checked={includeCampus}
                            onChange={(e, data) =>
                              setIncludeCampus(data.checked ?? true)
                            }
                          />
                        </div>
                        <span>Displaying </span>
                        <Dropdown
                          className="commons-content-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                        <ResultsText
                          resultsCount={numResultBooks}
                          totalCount={numTotalBooks}
                        />
                      </div>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <Dropdown
                        placeholder="Display mode..."
                        floating
                        selection
                        button
                        options={catalogDisplayOptions}
                        onChange={(_e, { value }) => {
                          setDisplayChoice(value as string);
                        }}
                        value={displayChoice}
                        fluid
                        aria-label="Set results display mode"
                      />
                      <Dropdown
                        placeholder="Sort by..."
                        floating
                        selection
                        button
                        options={sortOptions}
                        onChange={(_e, { value }) => {
                          setSortChoice(value as string);
                        }}
                        value={sortChoice}
                        fluid
                        className="commons-filter"
                        aria-label="Sort results by"
                      />
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="commons-pagination-mobile-container">
                      <ConductorPagination
                        activePage={activePage}
                        totalPages={totalPages}
                        siblingRange={0}
                        firstItem={null}
                        lastItem={null}
                        onPageChange={handleActivePageChange}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
            <Segment
              className={
                displayChoice === "visual"
                  ? "commons-content"
                  : "commons-content commons-content-itemized"
              }
              loading={!loadedData}
              aria-live="polite"
              aria-busy={!loadedData}
            >
              {displayChoice === "visual" ? <VisualMode /> : <ItemizedMode />}
            </Segment>
            <Segment>
              <Breakpoint name="desktop">
                <div className="commons-content-pagemenu">
                  <div className="commons-content-pagemenu-left">
                    <span>Displaying </span>
                    <Dropdown
                      className="commons-content-pagemenu-dropdown"
                      selection
                      options={catalogItemsPerPageOptions}
                      onChange={(_e, { value }) => {
                        setItemsPerPage(value as number);
                      }}
                      value={itemsPerPage}
                      aria-label="Number of results to display per page"
                    />
                    <ResultsText
                      resultsCount={numResultBooks}
                      totalCount={numTotalBooks}
                    />
                  </div>
                  <div className="commons-content-pagemenu-right">
                    <ConductorPagination
                      activePage={activePage}
                      totalPages={totalPages}
                      firstItem={null}
                      lastItem={null}
                      onPageChange={handleActivePageChange}
                      size="large"
                      siblingRange={0}
                    />
                  </div>
                </div>
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Grid>
                  <Grid.Row columns={1}>
                    <Grid.Column>
                      <div className="center-flex flex-wrap">
                        <span>Displaying </span>
                        <Dropdown
                          className="commons-content-pagemenu-dropdown"
                          selection
                          options={catalogItemsPerPageOptions}
                          onChange={(_e, { value }) => {
                            setItemsPerPage(value as number);
                          }}
                          value={itemsPerPage}
                          aria-label="Number of results to display per page"
                        />
                        <ResultsText
                          resultsCount={numResultBooks}
                          totalCount={numTotalBooks}
                        />
                      </div>
                    </Grid.Column>
                  </Grid.Row>
                  <Grid.Row columns={1}>
                    <Grid.Column className="commons-pagination-mobile-container">
                      <ConductorPagination
                        activePage={activePage}
                        totalPages={totalPages}
                        siblingRange={0}
                        firstItem={null}
                        lastItem={null}
                        onPageChange={handleActivePageChange}
                        size="mini"
                      />
                    </Grid.Column>
                  </Grid.Row>
                </Grid>
              </Breakpoint>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
