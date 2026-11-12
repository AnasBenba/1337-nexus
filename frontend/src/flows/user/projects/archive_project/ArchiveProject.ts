import { changeProjectStatus, Project } from '../projectApi';

export function archiveProject(projectId: string): Promise<Project> {
  return changeProjectStatus(projectId, 'archive');
}
