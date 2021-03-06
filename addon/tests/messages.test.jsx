/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Need to import utils.js to set up the fetch stub.
import { createFakeData, createFakeSummaryData } from "./utils.js";
import { jest } from "@jest/globals";
import { browser } from "../content/es-modules/thunderbird-compat.js";
import { messageEnricher } from "../content/reducer/messages.js";

describe("messageEnricher", () => {
  let fakeMessageHeaderData;
  let displayedMessagesSpy;

  beforeEach(() => {
    fakeMessageHeaderData = new Map();
    jest
      .spyOn(browser.messages, "get")
      .mockImplementation(async (id) => fakeMessageHeaderData.get(id));
    displayedMessagesSpy = jest.spyOn(
      browser.messageDisplay,
      "getDisplayedMessages"
    );
    displayedMessagesSpy.mockImplementation(async () => {
      return [{ id: fakeMessageHeaderData.size - 1 }];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Header Details", () => {
    test("Fills out the message with details from the header", async () => {
      let fakeMsg = createFakeData({}, fakeMessageHeaderData);

      await messageEnricher.enrich(
        "replaceAll",
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true })
      );

      expect(fakeMsg).toMatchObject({
        isDraft: false,
        isJunk: false,
        isOutbox: false,
        read: false,
        shortFolderName: "Inbox",
        folderName: "Fake/Folder",
        subject: "Fake Msg",
        starred: false,
        tags: [],
      });
    });

    test("Correctly sets flags with details from the header", async () => {
      let tests = [
        {
          source: {
            id: 1,
            folderType: "drafts",
            folderName: "Drafts",
            read: true,
            subject: "A draft",
            flagged: true,
          },
          expected: {
            isDraft: true,
            isJunk: false,
            isOutbox: false,
            read: true,
            shortFolderName: "Drafts",
            folderName: "Fake/Folder",
            subject: "A draft",
            starred: true,
            tags: [],
          },
        },
        {
          source: {
            id: 2,
            folderType: "outbox",
            folderName: "Outbox",
          },
          expected: {
            isDraft: false,
            isJunk: false,
            isOutbox: true,
            shortFolderName: "Outbox",
          },
        },
        {
          source: {
            id: 3,
            folderType: "inbox",
            junk: true,
          },
          expected: {
            isDraft: false,
            isJunk: true,
            isOutbox: false,
          },
        },
      ];

      for (let test of tests) {
        let fakeMsg = createFakeData(test.source, fakeMessageHeaderData);
        displayedMessagesSpy.mockImplementation(async () => {
          return [{ id: test.source.id }];
        });

        await messageEnricher.enrich(
          "replaceAll",
          [fakeMsg],
          createFakeSummaryData({ noFriendlyDate: true })
        );

        expect(fakeMsg).toMatchObject(test.expected);
      }
    });

    test("Obtains the informaiton for tags", async () => {
      let fakeMsg = createFakeData(
        {
          tags: ["$label1", "$label3"],
        },
        fakeMessageHeaderData
      );

      await messageEnricher.enrich(
        "replaceAll",
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true })
      );

      expect(fakeMsg).toMatchObject({
        tags: [
          {
            color: "#ff2600",
            key: "$label1",
            name: "Important",
          },
          {
            color: "#009900",
            key: "$label3",
            name: "Personal",
          },
        ],
      });
    });
  });

  describe("Expansion and Scroll To", () => {
    test("Expands all messages when expand is set to all", async () => {
      let fakeMsgs = [];
      for (let i = 0; i < 5; i++) {
        fakeMsgs.push(createFakeData({ id: i }, fakeMessageHeaderData));
      }

      await messageEnricher.enrich(
        "replaceAll",
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 })
      );

      for (let i = 0; i < 5; i++) {
        expect(fakeMsgs[i].expanded).toBe(true);
        if (i < 4) {
          expect("scrollTo" in fakeMsgs[i]).toBe(false);
        } else {
          expect(fakeMsgs[i].scrollTo).toBe(true);
        }
      }
    });

    test("Expands no messages when expand is set to none", async () => {
      let fakeMsgs = [];
      for (let i = 0; i < 5; i++) {
        fakeMsgs.push(createFakeData({ id: i }, fakeMessageHeaderData));
      }

      await messageEnricher.enrich(
        "replaceAll",
        fakeMsgs,
        createFakeSummaryData({ expandWho: 1 })
      );

      for (let i = 0; i < 5; i++) {
        expect(fakeMsgs[i].expanded).toBe(false);
        if (i < 4) {
          expect("scrollTo" in fakeMsgs[i]).toBe(false);
        } else {
          expect(fakeMsgs[i].scrollTo).toBe(true);
        }
      }
    });

    describe("Expansion Auto", () => {
      test("Single, all read - expand and select selection", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: true }, fakeMessageHeaderData)
          );
        }
        displayedMessagesSpy.mockImplementation(async () => {
          return [{ id: 3 }];
        });

        await messageEnricher.enrich(
          "replaceAll",
          fakeMsgs,
          createFakeSummaryData()
        );

        for (let i = 0; i < 5; i++) {
          expect(fakeMsgs[i].expanded).toBe(i == 3);
          if (i != 3) {
            expect("scrollTo" in fakeMsgs[i]).toBe(false);
          } else {
            expect(fakeMsgs[i].scrollTo).toBe(true);
          }
        }
      });

      test("Single, multi unread  - expand single and scroll it", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: i <= 2 }, fakeMessageHeaderData)
          );
        }
        displayedMessagesSpy.mockImplementation(async () => {
          return [{ id: 3 }];
        });

        await messageEnricher.enrich(
          "replaceAll",
          fakeMsgs,
          createFakeSummaryData()
        );

        for (let i = 0; i < 5; i++) {
          expect(fakeMsgs[i].expanded).toBe(i == 3);
          if (i != 3) {
            expect("scrollTo" in fakeMsgs[i]).toBe(false);
          } else {
            expect(fakeMsgs[i].scrollTo).toBe(true);
          }
        }
      });

      test("Multi, unread - expand unread, select first", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: i <= 2 }, fakeMessageHeaderData)
          );
        }
        displayedMessagesSpy.mockImplementation(async () => {
          return [{ id: 3 }, { id: 4 }];
        });

        await messageEnricher.enrich(
          "replaceAll",
          fakeMsgs,
          createFakeSummaryData()
        );

        for (let i = 0; i < 5; i++) {
          expect(fakeMsgs[i].expanded).toBe(i > 2);
          // Should have selected the first unread.
          if (i != 3) {
            expect("scrollTo" in fakeMsgs[i]).toBe(false);
          } else {
            expect(fakeMsgs[i].scrollTo).toBe(true);
          }
        }
      });
    });
  });

  describe("Attachments", () => {
    test("Extends the information for attachments", async () => {
      let fakeMsg = createFakeData(
        {
          attachments: [
            {
              contentType: "application/pdf",
              isExternal: false,
              name: "foo.pdf",
              partName: "1.2",
              size: 634031,
              url: "imap://fakeurl",
            },
          ],
        },
        fakeMessageHeaderData
      );

      await messageEnricher.enrich(
        "replaceAll",
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true })
      );

      expect(fakeMsg).toMatchObject({
        attachments: [
          {
            anchor: "msg0att0",
            contentType: "application/pdf",
            formattedSize: "634031 bars",
            isExternal: false,
            name: "foo.pdf",
            partName: "1.2",
            size: 634031,
            url: "imap://fakeurl",
          },
        ],
      });
    });
  });

  describe("Snippets", () => {
    test("Adjusts the snippet for better output from bugzilla", async () => {
      const msgSnippets = [
        {
          actual: "My message snippet",
          expected: "My message snippet",
        },
        {
          actual:
            "https://bugzilla.mozilla.org/show_bug.cgi?id=1199577\n\nSausages <sausages@example.com> changed:\n",
          expected: "\n\nSausages <sausages@example.com> changed:\n",
        },
        {
          actual: `https://bugzilla.mozilla.org/show_bug.cgi?id=1712565

Petruta Horea [:phorea] <petruta.rasa@softvision.com> changed:

           What    |Removed                     |Added
----------------------------------------------------------------------------
             Status|RESOLVED                    |VERIFIED
   status-firefox91|fixed                       |verified

--- Comment #5 from Petruta Horea [:phorea] <petruta.rasa@softvision.com> 2021-06-03 11:25:00 BST ---
Updating`,
          expected: "\nUpdating",
        },
      ];
      const fakeMsgs = msgSnippets.map((snippet, index) =>
        createFakeData(
          {
            id: index + 1,
            snippet: snippet.actual,
          },
          fakeMessageHeaderData
        )
      );
      await messageEnricher.enrich(
        "replaceAll",
        fakeMsgs,
        createFakeSummaryData()
      );

      for (let [i, fakeMsg] of fakeMsgs.entries()) {
        expect(fakeMsg.snippet).toBe(msgSnippets[i].expected);
      }
    });
  });

  describe("Dates", () => {
    test("Sets the dates for displaying friendly dates", async () => {
      let now = Date.now();
      let fakeMsg = createFakeData({ date: now }, fakeMessageHeaderData);

      await messageEnricher.enrich(
        "replaceAll",
        [fakeMsg],
        createFakeSummaryData()
      );

      expect(fakeMsg.date).toBe("yesterday");
      expect(fakeMsg.fullDate).toBe(
        new Intl.DateTimeFormat(undefined, {
          timeStyle: "short",
        }).format(now)
      );
    });

    test("Sets the dates for not displaying friendly dates", async () => {
      let now = Date.now();
      let fakeMsg = createFakeData({ date: now }, fakeMessageHeaderData);

      await messageEnricher.enrich(
        "replaceAll",
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true })
      );

      expect(fakeMsg.date).toBe(
        new Intl.DateTimeFormat(undefined, {
          timeStyle: "short",
        }).format(now)
      );
      expect(fakeMsg.fullDate).toBe("");
    });
  });
});
