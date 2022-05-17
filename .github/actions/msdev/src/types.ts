export interface Project {
    tenant?: string;
    fidalgo: Fidalgo;
}

export interface Fidalgo {
    extension?: string;
    project: FidalgoProject;
    catalog_item: string;
}

export interface FidalgoProject {
    name: string;
    group: string;
}
