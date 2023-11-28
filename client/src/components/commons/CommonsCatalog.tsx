import "./Commons.css";
import { Grid, Segment, Header, Form, Dropdown } from "semantic-ui-react";
import { useEffect, useState, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import { useLocation, useHistory } from "react-router-dom";
import axios, { all } from "axios";
import useGlobalError from "../error/ErrorHooks";
import { updateParams } from "../util/HelperFunctions.js";
import {
  Book,
  CatalogLocation,
  GenericKeyTextValueObj,
  ProjectFileWProjectID,
} from "../../types";
import api from "../../api";
import CatalogTable from "./CommonsCatalog/CatalogTable";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import VisualMode from "./CommonsCatalog/VisualMode";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";

const CommonsCatalog = () => {
  const { handleGlobalError, error } = useGlobalError();

  // Global State and Location/History
  const location = useLocation();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  // Data
  const [items, setItems] = useState<Array<Book | ProjectFileWProjectID>>([]);
  const [allItems, setAllItems] = useState<Array<Book | ProjectFileWProjectID>>(
    []
  );
  const [numResultItems, setNumResultItems] = useState<number>(0);
  const [numTotalItems, setNumTotalItems] = useState<number>(0);

  /** UI **/
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);
  const [loadedData, setLoadedData] = useState<boolean>(true);

  const [loadedFilters, setLoadedFilters] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const initialSearch = useRef(true);
  const checkedParams = useRef(false);

  const { observe } = useInfiniteScroll(
    () => {
      console.log("intersected");
      setActivePage(activePage + 1);
    },
    {
      loading: false,
      preventUnobserve: true,
    }
  );

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
    loadCommonsCatalog();
    //searchCommonsCatalog();
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

  async function loadCommonsCatalog() {
    try {
      setLoadedData(false);
      const res = await api.getCommonsCatalog();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.books)) {
        setAllItems(res.data.books);
      }
      if (typeof res.data.numFound === "number") {
        setNumResultItems(res.data.numFound);
      }
      if (typeof res.data.numTotal === "number") {
        setNumTotalItems(res.data.numTotal);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }

  // /**
  //  * Perform GET request for books
  //  * and update catalogBooks.
  //  */
  // const searchCommonsCatalog = async () => {
  //   try {
  //     setLoadedData(false);
  //     let paramsObj: FilterParams = {
  //       sort: sortChoice,
  //     };
  //     if (!isEmptyString(searchString)) {
  //       paramsObj.search = searchString;
  //     }
  //     if (!isEmptyString(libraryFilter)) {
  //       paramsObj.library = libraryFilter;
  //     }
  //     if (!isEmptyString(subjectFilter)) {
  //       paramsObj.subject = subjectFilter;
  //     }
  //     if (!isEmptyString(locationFilter)) {
  //       paramsObj.location = locationFilter;
  //     }
  //     if (!isEmptyString(authorFilter)) {
  //       paramsObj.author = authorFilter;
  //     }
  //     if (!isEmptyString(licenseFilter)) {
  //       paramsObj.license = licenseFilter;
  //     }
  //     if (!isEmptyString(affilFilter)) {
  //       paramsObj.affiliation = affilFilter;
  //     }
  //     if (!isEmptyString(courseFilter)) {
  //       paramsObj.course = courseFilter;
  //     }
  //     if (!isEmptyString(pubFilter)) {
  //       paramsObj.publisher = pubFilter;
  //     }
  //     if (!isEmptyString(cidFilter)) {
  //       paramsObj.cidDescriptor = cidFilter;
  //     }

  //     const res = await axios.get("/commons/catalog", {
  //       params: paramsObj,
  //     });

  //     if (res.data.err) {
  //       throw new Error(res.data.errMsg);
  //     }

  //     if (Array.isArray(res.data.books)) {
  //       setAllItems(res.data.books);
  //     }
  //     if (typeof res.data.numFound === "number") {
  //       setNumResultItems(res.data.numFound);
  //     }
  //     if (typeof res.data.numTotal === "number") {
  //       setNumTotalItems(res.data.numTotal);
  //     }
  //   } catch (err) {
  //     handleGlobalError(err);
  //   } finally {
  //     setLoadedData(true);
  //   }
  // };

  /**
   * Perform GET request for books
   * and update catalogBooks.
   */
  const newSearch = async () => {
    try {
      setLoadedData(false);

      // console.log(paramsObj.search);
      const res = await api.conductorSearch({
        searchQuery: searchString,
        activePage,
        limit: itemsPerPage,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      setItems([...res.data.results.books, ...res.data.results.files]);

      if (typeof res.data.numResults === "number") {
        setNumResultItems(res.data.numResults);
        const totalPages = Math.ceil(res.data.numResults / itemsPerPage);
        setTotalPages(totalPages);
      }
      // if (typeof res.data.numTotal === "number") {
      //   setNumTotalBooks(res.data.numTotal);
      // }
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

  useEffect(() => {
    if (allItems.length > 0) {
      const sliceEnd = activePage * itemsPerPage;
      setItems(allItems.slice(0, sliceEnd));
    }
  }, [activePage, allItems, itemsPerPage, setItems]);

  /**
   * Perform the Catalog search based on
   * URL query change after ensuring the
   * initial URL params sync has been
   * performed.
   */
  useEffect(() => {
    if (checkedParams.current) {
      // searchCommonsCatalog();
    }
  }, [checkedParams.current]);

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
   * Subscribe to changes in the URL search string
   * and update state accordingly.
   */
  // useEffect(() => {
  //   let params = queryString.parse(location.search);
  //   if (Object.keys(params).length > 0 && !initialSearch.current) {
  //     // enable results for those entering a direct search URL
  //     initialSearch.current = true;
  //   }
  //   if (params.mode && params.mode !== displayChoice) {
  //     if (params.mode === "visual" || params.mode === "itemized") {
  //       setDisplayChoice(params.mode);
  //     }
  //   }
  //   if (
  //     params.items &&
  //     typeof params.items === "number" &&
  //     parseInt(params.items) !== itemsPerPage
  //   ) {
  //     if (!isNaN(parseInt(params.items))) {
  //       setItemsPerPage(params.items);
  //     }
  //   }
  //   // if (
  //   //   params.search !== undefined &&
  //   //   params.search !== searchString &&
  //   //   typeof params.search === "string"
  //   // ) {
  //   //   setSearchString(params.search);
  //   // }
  //   if (
  //     params.sort !== undefined &&
  //     params.sort !== sortChoice &&
  //     typeof params.sort === "string"
  //   ) {
  //     setSortChoice(params.sort);
  //   }
  //   if (
  //     params.library !== undefined &&
  //     params.library !== libraryFilter &&
  //     typeof params.library === "string"
  //   ) {
  //     setLibraryFilter(params.library);
  //   }
  //   if (
  //     params.subject !== undefined &&
  //     params.subject !== subjectFilter &&
  //     typeof params.subject === "string"
  //   ) {
  //     setSubjectFilter(params.subject);
  //   }
  //   if (
  //     params.location !== undefined &&
  //     params.location !== locationFilter &&
  //     typeof params.location === "string" &&
  //     isCatalogLocation(params.location)
  //   ) {
  //     if (params.location === "all") {
  //       setIncludeCampus(true);
  //       setIncludeCentral(true);
  //     } else if (params.location === "campus") {
  //       setIncludeCampus(true);
  //       setIncludeCentral(false);
  //     } else if (params.location === "central") {
  //       setIncludeCampus(false);
  //       setIncludeCentral(true);
  //     } else {
  //       setIncludeCampus(false);
  //       setIncludeCentral(false);
  //     }
  //     setLocationFilter(params.location);
  //   }
  //   if (
  //     params.license !== undefined &&
  //     params.license !== licenseFilter &&
  //     typeof params.license === "string"
  //   ) {
  //     setLicenseFilter(params.license);
  //   }
  //   if (
  //     params.author !== undefined &&
  //     params.author !== authorFilter &&
  //     typeof params.author === "string"
  //   ) {
  //     setAuthorFilter(params.author);
  //   }
  //   if (
  //     params.affiliation !== undefined &&
  //     params.affiliation !== affilFilter &&
  //     typeof params.affiliation === "string"
  //   ) {
  //     setAffilFilter(params.affiliation);
  //   }
  //   if (
  //     params.course !== undefined &&
  //     params.course !== courseFilter &&
  //     typeof params.course === "string"
  //   ) {
  //     setCourseFilter(params.course);
  //   }
  //   if (
  //     params.publisher !== undefined &&
  //     params.publisher !== pubFilter &&
  //     typeof params.publisher === "string"
  //   ) {
  //     setPubFilter(params.publisher);
  //   }
  //   if (
  //     params.cid !== undefined &&
  //     params.cid !== cidFilter &&
  //     typeof params.cid === "string"
  //   ) {
  //     setCIDFilter(params.cid);
  //   }
  //   if (!checkedParams.current) {
  //     // set the initial URL params sync to complete
  //     checkedParams.current = true;
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [location.search]);

  const ItemizedMode = () => {
    return <CatalogTable items={items} />;
  };

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            {((org.commonsHeader && org.commonsHeader !== "") ||
              (org.commonsMessage && org.commonsMessage !== "")) && (
              <Segment padded>
                {org.commonsHeader && org.commonsHeader !== "" && (
                  <Header
                    id="commons-intro-header"
                    as="h2"
                    className="text-center lg:text-left"
                  >
                    {org.commonsHeader}
                  </Header>
                )}
                <p
                  id="commons-intro-message"
                  className="text-center lg:text-left"
                >
                  {org.commonsMessage}
                </p>
              </Segment>
            )}
            <Segment>
              <div className="my-8 mx-56">
                <Form onSubmit={newSearch}>
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
                    action={{
                      content: "Search Catalog",
                      color: "blue",
                      onClick: newSearch,
                    }}
                  />
                </Form>
              </div>
              <CatalogTabs
                paneProps={{ loading: false}}
                booksCount={allItems.length}
              >
                <CatalogBookFilters />
                <VisualMode items={items} />
              </CatalogTabs>
              <div
                className="commons-content-card-grid-sentry text-center"
                ref={observe}
              ></div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
