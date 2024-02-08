import "./Commons.css";
import { Grid, Segment, Header, Form, Icon } from "semantic-ui-react";
import { useEffect, useState, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import useDebounce from "../../hooks/useDebounce";
import {
  AssetFilters,
  Book,
  BookFilters,
  Project,
  ProjectFileWCustomData,
  ProjectFileWProjectData,
} from "../../types";
import AdvancedSearchDrawer from "./AdvancedSearchDrawer";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { useLocation } from "react-router-dom";

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();

  const [loadingDisabled, setLoadingDisabled] = useState(false);

  const ITEMS_PER_PAGE = 24;

  const [searchString, setSearchString] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [activePage, setActivePage] = useState(1);
  const [strictMode, setStrictMode] = useState(false);

  const [bookFilters, setBookFilters] = useState<BookFilters>({});
  const [assetFilters, setAssetFilters] = useState<AssetFilters>({});

  const [books, setBooks] = useState<Book[]>([]);
  const [booksCount, setBooksCount] = useState<number>(0);

  const [assets, setAssets] = useState<
    ProjectFileWProjectData<"title" | "thumbnail">[]
  >([]);
  const [assetsCount, setAssetsCount] = useState<number>(0);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsCount, setProjectsCount] = useState<number>(0);

  const [booksLoading, setBooksLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(location.search).get("search");
    if (search) {
      setSearchString(search);
      runSearch(search);
    } else {
      loadInitialData();
    }
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

  const updateSearchParam = () => {
    const search = searchString.trim();
    const url = new URL(window.location.href);

    if (search === "") {
      clearSearchParam();
      if(assetFiltersApplied() || bookFiltersApplied()) {
        runSearch(search); // handle no search query but filters
      } else {
        loadInitialData(true);
      }
      return;
    } else {
      url.searchParams.set("search", search);
      window.history.pushState({}, "", url.toString());
      runSearch(search);
    }
  };

  const clearSearchParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.pushState({}, "", url.toString());
  };

  const handleResetSearch = () => {
    clearSearchParam();
    setSearchString("");
    setBookFilters({});
    setAssetFilters({});
    setActivePage(1);
    setBooks([]);
    setAssets([]);
    setProjects([]);
    loadInitialData(true);
  };

  async function runSearch(query?: string) {
    try {
      if (loadingDisabled) return;
      setActivePage(1);

      await Promise.all([
        handleBooksSearch(query ?? searchString, true),
        handleAssetsSearch(1, query ?? searchString, true),
        handleProjectsSearch(query ?? searchString, true),
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function loadInitialData(clear = false) {
    try {
      if (loadingDisabled) return;
      await Promise.all([
        loadCommonsCatalog(clear),
        loadPublicAssets(clear),
        loadPublicProjects(clear),
      ]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  // Books
  async function loadCommonsCatalog(clear = false) {
    try {
      setBooksLoading(true);
      const res = await api.getCommonsCatalog({
        activePage: activePage,
        limit: ITEMS_PER_PAGE,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.books)) {
        if (clear) {
          setBooks([...res.data.books]);
        } else {
          setBooks([...books, ...res.data.books]);
        }
      }
      if (typeof res.data.numTotal === "number") {
        setBooksCount(res.data.numTotal);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBooksLoading(false);
    }
  }

  async function handleBooksSearch(query?: string, clearAndUpdate = false) {
    try {
      setBooksLoading(true);
      const res = await api.booksSearch({
        ...(query && { searchQuery: query }),
        strictMode,
        page: activePage,
        limit: ITEMS_PER_PAGE,
        ...bookFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        updateBooks(res.data.results, clearAndUpdate);
      }

      if (typeof res.data.numResults === "number") {
        setBooksCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setBooksLoading(false);
    }
  }

  // Assets
  async function loadPublicAssets(clear = false) {
    try {
      setAssetsLoading(true);
      const res = await api.getPublicProjectFiles({
        page: activePage,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.files)) {
        if (clear) {
          setAssets(res.data.files);
        } else {
          updateAssets(res.data.files, false);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setAssetsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAssetsLoading(false);
    }
  }

  async function handleAssetsSearch(
    page = 1,
    query?: string,
    clearAndUpdate = false
  ) {
    try {
      setAssetsLoading(true);
      const res = await api.assetsSearch({
        ...(query && { searchQuery: query }),
        strictMode,
        page,
        limit: ITEMS_PER_PAGE,
        ...assetFilters,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        updateAssets(res.data.results, clearAndUpdate);
      }
      if (typeof res.data.numResults === "number") {
        setAssetsCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAssetsLoading(false);
    }
  }

  // Projects
  async function loadPublicProjects(clear = false) {
    try {
      setProjectsLoading(true);
      const res = await api.getPublicProjects({
        page: activePage,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (Array.isArray(res.data.projects)) {
        if (clear) {
          setProjects(res.data.projects);
        } else {
          setProjects([...projects, ...res.data.projects]);
        }
      }
      if (typeof res.data.totalCount === "number") {
        setProjectsCount(res.data.totalCount);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function handleProjectsSearch(query?: string, clearAndUpdate = false) {
    try {
      setProjectsLoading(true);
      const res = await api.projectsSearch({
        searchQuery: query,
        strictMode: false,
        page: activePage,
        limit: ITEMS_PER_PAGE,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.results) {
        throw new Error("No results found.");
      }

      if (Array.isArray(res.data.results)) {
        updateProjects(res.data.results, clearAndUpdate);
      }

      if (typeof res.data.numResults === "number") {
        setProjectsCount(res.data.numResults);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setProjectsLoading(false);
    }
  }

  const bookFiltersApplied = (): boolean => {
    return Object.keys(bookFilters).length !== 0;
  };

  const assetFiltersApplied = (): boolean => {
    return Object.keys(assetFilters).length !== 0;
  };

  function handleLoadMoreBooks() {
    if (loadingDisabled) return;
    setActivePage(activePage + 1);
    if (searchString || bookFiltersApplied()) {
      return handleBooksSearch(searchString);
    } else {
      return loadCommonsCatalog();
    }
  }

  function handleLoadMoreAssets() {
    if (loadingDisabled) return;
    const nextPage = activePage + 1;
    setActivePage(nextPage);
    if (searchString || assetFiltersApplied()) {
      return handleAssetsSearch(nextPage, searchString);
    } else {
      return loadPublicAssets();
    }
  }

  function handleLoadMoreProjects() {
    if (loadingDisabled) return;
    setActivePage(activePage + 1);
    if (searchString) {
      return handleProjectsSearch(searchString);
    } else {
      return loadPublicProjects();
    }
  }

  /**
   * This is a workaround to handle cases where we want to clear the existing state,
   * but React doesn't update the state immediately/recognize the change.
   * This helps us distinguish between the case where a new search was ran and no results were found,
   * and the case where we are just loading more results, and don't want to clear the existing state.
   */
  function updateAssets(
    newAssets: ProjectFileWProjectData<"title" | "thumbnail">[],
    clearAndUpdate = false
  ) {
    if (clearAndUpdate) {
      setAssets([...newAssets]);
    } else {
      setAssets([...assets, ...newAssets]);
    }
  }

  function updateBooks(newBooks: Book[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setBooks([...newBooks]);
    } else {
      setBooks([...books, ...newBooks]);
    }
  }

  function updateProjects(newProjects: Project[], clearAndUpdate = false) {
    if (clearAndUpdate) {
      setProjects([...newProjects]);
    } else {
      setProjects([...projects, ...newProjects]);
    }
  }

  function handleTabChange(index: number) {
    setActiveIndex(index);
    setActivePage(1);
  }

  function handleRemoveBookFilter(filter: keyof BookFilters) {
    const newFilters = { ...bookFilters };
    delete newFilters[filter];
    setBookFilters(newFilters);
  }

  function handleRemoveAssetFilter(filter: keyof AssetFilters) {
    const newFilters = { ...assetFilters };
    delete newFilters[filter];
    setAssetFilters(newFilters);
  }

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
              <div className="mt-8 mb-6 mx-56">
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <Form.Input
                      icon="search"
                      placeholder="Search..."
                      className="color-libreblue !mb-0"
                      id="commons-search-input"
                      iconPosition="left"
                      onChange={(e) => setSearchString(e.target.value)}
                      fluid
                      value={searchString}
                      aria-label="Search query"
                      action={{
                        content: "Search Catalog",
                        color: "blue",
                        onClick: () => updateSearchParam(),
                      }}
                    />
                  </div>
                </Form>
                <div
                  className="flex flex-row items-center justify-center text-primary font-semibold cursor-pointer text-center mt-4"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <Icon
                    name={showAdvanced ? "caret down" : "caret right"}
                    className="mr-1 !mb-2"
                  />
                  <p className="">Advanced Search</p>
                  <Icon
                    name={showAdvanced ? "caret down" : "caret left"}
                    className="ml-1 !mb-2"
                  />
                </div>
              </div>
              {showAdvanced && (
                <div className="mb-8">
                  <AdvancedSearchDrawer
                    searchString={searchString}
                    setSearchString={setSearchString}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    submitSearch={updateSearchParam}
                    bookFilters={bookFilters}
                    setBookFilters={setBookFilters}
                    assetFilters={assetFilters}
                    setAssetFilters={setAssetFilters}
                    strictMode={strictMode}
                    setStrictMode={setStrictMode}
                  />
                </div>
              )}
              {(searchString !== "" ||
                Object.keys(bookFilters).length !== 0 ||
                Object.keys(assetFilters).length !== 0) && (
                <p
                  className="italic font-semibold cursor-pointer underline text-center mt-2"
                  onClick={handleResetSearch}
                >
                  Reset Search
                </p>
              )}
              <CatalogTabs
                assetFilters={assetFilters}
                bookFilters={bookFilters}
                activeIndex={activeIndex}
                onActiveTabChange={handleTabChange}
                books={books}
                booksCount={booksCount}
                assets={assets}
                assetsCount={assetsCount}
                projects={projects}
                projectsCount={projectsCount}
                booksLoading={booksLoading}
                assetsLoading={assetsLoading}
                projectsLoading={projectsLoading}
                onLoadMoreBooks={handleLoadMoreBooks}
                onLoadMoreAssets={handleLoadMoreAssets}
                onLoadMoreProjects={handleLoadMoreProjects}
                onRemoveAssetFilter={handleRemoveAssetFilter}
                onRemoveBookFilter={handleRemoveBookFilter}
                onTriggerStopLoading={() => setLoadingDisabled(true)}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
