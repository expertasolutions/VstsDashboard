import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import { getBuildDefinitions, getBuilds , getReleases, getProjects } from "./PipelineServices";
import { dashboardColumns, buildColumns }  from "./tableData";

import { KeywordFilterBarItem } from "azure-devops-ui/TextFilterBarItem";
import { Button } from "azure-devops-ui/Button";
import { Dropdown, DropdownFilterBarItem } from "azure-devops-ui/Dropdown";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { Card } from "azure-devops-ui/Card";
import { Table } from "azure-devops-ui/Table";
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page } from "azure-devops-ui/Page";

import { TeamProjectReference } from "azure-devops-extension-api/Core";
import { BuildDefinitionReference, Build } from "azure-devops-extension-api/Build";
import { Deployment } from "azure-devops-extension-api/Release";

import { showRootComponent } from "../../Common";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { Observer } from "azure-devops-ui/Observer";
import { DataContext }  from "./dataContext";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { Filter, FilterOperatorType, FILTER_CHANGE_EVENT } from "azure-devops-ui/Utilities/Filter";
import { FilterBar } from "azure-devops-ui/FilterBar";
import { ZeroData, ZeroDataActionType } from "azure-devops-ui/ZeroData";
import { ResultObjectType } from "azure-devops-extension-api/Test/Test";

class CICDDashboard extends React.Component<{}, {}> {
  private selectedTabId = new ObservableValue("summary");
  private projectSelection = new DropdownSelection();
  private filter: Filter = new Filter();
  private currentProjectSelected: string = "";
  private currentState = new ObservableValue("");

  constructor(props: {}) {
    super(props);

    this.filter = new Filter();
    this.filter.setFilterItemState("listMulti", {
      value: [],
      operator: FilterOperatorType.and
    });

    this.filter.subscribe(() => {
      this.currentState.value = JSON.stringify(this.filter.getState(), null, 4);
    }, FILTER_CHANGE_EVENT);
  }

  state = {
    buildDefs: Array<BuildDefinitionReference>(),
    builds: Array<Build>(),
    releases: Array<Deployment>(),
    projects: Array<TeamProjectReference>(),
  };

  private onProjectSelected = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) => {
    let projectName = "";
    if(item.text != undefined)
      projectName = item.text;

    this.currentProjectSelected = projectName;
    console.log("SelectedProject: " + this.currentState);
    getBuildDefinitions(projectName).then(result => {
      this.setState({ buildDefs: result });
      this.buildReferenceProvider.value = new ArrayItemProvider(this.state.buildDefs);
    });

    getReleases(projectName).then(result => {
      this.setState({releases: result });
    });

    // Update Builds Runs list...
    getBuilds(projectName).then(result=> {
      this.setState({ builds: result });
      this.buildProvider.value = new ArrayItemProvider(this.state.builds);
    });
  }

  public loadProjects() {
    getProjects().then(result => {
      this.setState( { projects: result });
    });
  }

  public componentDidMount() {
    SDK.init();
    this.loadProjects();
  }

  private buildReferenceProvider = new ObservableValue<ArrayItemProvider<BuildDefinitionReference>>(new ArrayItemProvider(this.state.buildDefs));
  private buildProvider = new ObservableValue<ArrayItemProvider<Build>>(new ArrayItemProvider(this.state.builds));

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
  }

  private getProjectUrl(projectName:string) {
    console.log("getProjectUrl: " + projectName);
    let prj = this.state.projects.find(x=> x.name === projectName);
    if(prj === undefined){
      return "http://perdu.com";
    }
    return prj.url;
  }

  private renderZeroData(tabId: string) : JSX.Element {
    if(tabId === "summary" && this.buildReferenceProvider.value.length === 0){
      return (
        <div>
          <ZeroData
            primaryText="Create your first Pipeline"
            secondaryText={
              <span>
                Automate your build and release processes using our wizard, and go
                from code to cloud-hosted within minutes.
              </span>
            }
            imageAltText="Bars"
            imagePath="https://cdn.vsassets.io/ext/ms.vss-build-web/pipelines/Content/no-builds.G8i4mxU5f17yTzxc.png"
            actionText="Create Pipeline"
            actionType={ZeroDataActionType.ctaButton}
            onActionClick={(event, item) =>{
                let projectUrl = this.getProjectUrl(this.currentProjectSelected);
                window.open(projectUrl, "_blank");
              }
            }
          />
        </div>
      );
    } else {
      return <div></div>;
    }
  }

  private renderTab(tabId: string) : JSX.Element {
    if(tabId === "summary") {
      return (
        <Observer itemProvider={this.buildReferenceProvider}>
          {(observableProps: {itemProvider: ArrayItemProvider<BuildDefinitionReference> }) => 
            {
              if(observableProps.itemProvider.length > 0) {
                return (
                  <Table<BuildDefinitionReference> columns={dashboardColumns} 
                      itemProvider={observableProps.itemProvider}
                      showLines={true}
                      role="table"/>
                );
              } else {
                return this.renderZeroData(tabId);
              }
            }
          }
        </Observer>
      )
    } else if(tabId === "builds") {
      return (
        <Observer itemProvider={ this.buildProvider }>
          {(observableProps: {itemProvider: ArrayItemProvider<Build> }) => (
              <Table<Build> columns={buildColumns} 
                  itemProvider={observableProps.itemProvider}
                  showLines={true}
                  role="table"/>
          )}
        </Observer>
      )
    } else {
      return (<div>{tabId}</div>)
    }
  }

  public render() : JSX.Element {
    return (
      <Surface background={SurfaceBackground.neutral}>
        <Page className="pipelines-page flex-grow">
          <Header title="CI/CD Dashboard" titleSize={TitleSize.Large} />
          <TabBar
            onSelectedTabChanged={this.onSelectedTabChanged}
            selectedTabId={this.selectedTabId}
            tabSize={TabSize.Tall}>
            <Tab name="Summary" id="summary"/>
            <Tab name="Runs" id="builds"/>
          </TabBar>
          <FilterBar filter={this.filter}>
            <KeywordFilterBarItem filterItemKey="Placeholder" />
            <DropdownFilterBarItem
              filterItemKey="listSingle"
              filter={this.filter}
              items={this.state.projects.map(i => {
                return {
                  id: i.id,
                  text: i.name
                };
              })}
              placeholder="Team Project"
              showFilterBox={true}
              onSelect={this.onProjectSelected}
              selection={this.projectSelection}
            />
          </FilterBar>
          
          <div className="page-content page-content-top">
            <Card className="flex-grow bolt-table-card" 
                  titleProps={{ text: "All pipelines" }} 
                  contentProps={{ contentPadding: false }}>
              <DataContext.Provider value={{ state: this.state }}>
                <Observer selectedTabId={this.selectedTabId}>
                  {(props: { selectedTabId: string }) => {
                    return (
                      <div style={{ marginTop: "16px;"}}>
                          { this.renderTab(props.selectedTabId)}
                      </div>
                    )
                  }}
                </Observer>
              </DataContext.Provider>
            </Card>
          </div>
        </Page>
      </Surface>
    );
  }
}

showRootComponent(<CICDDashboard />);