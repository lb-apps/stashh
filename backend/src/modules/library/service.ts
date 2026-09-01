import type { LibrarySummaryList, LibrarySummaryResponse } from "./types.js";
import type { LibraryRepository } from "./repository.js";
import type { ListsService } from "../lists/service.js";
import type { PlacesRepository } from "../places/repository.js";
import type { Logger } from "../../lib/logger.js";

export class LibraryService {
  constructor(
    private readonly libraryRepo: LibraryRepository,
    private readonly placesRepo: PlacesRepository,
    private readonly listsService: ListsService,
    private readonly log: Logger,
  ) {}

  async getLibrarySummary(ownerUserId: string): Promise<LibrarySummaryResponse> {
    this.log.debug({ ownerUserId }, "library: fetching summary");

    const [districts, categories, lists, total_saved_count] = await Promise.all([
      this.libraryRepo.getDistrictCounts(ownerUserId),
      this.libraryRepo.getCategoryCounts(ownerUserId),
      this.listsService.listLists(ownerUserId),
      this.placesRepo.countSavedPlaces(ownerUserId),
    ]);

    const listDtos: LibrarySummaryList[] = lists.map((l) => ({
      id: l.id,
      title: l.title,
      emoji: l.emoji,
      place_count: l.place_count,
    }));

    this.log.debug(
      {
        ownerUserId,
        districtCount: districts.length,
        categoryCount: categories.length,
        listCount: listDtos.length,
        total_saved_count,
      },
      "library: summary fetched",
    );

    return {
      districts,
      categories,
      lists: listDtos,
      total_saved_count,
    };
  }
}
