/* 

  This endpoint updates title and/or description of Miro app cards when the corresponding data source is updated in GitHub.

**/
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.VITE_DATABASE_URL,
  process.env.VITE_DATABASE_PUBLIC_KEY,
);

console.log('we are in issues functions')

exports.handler = async function (event) {
  if (!event.body) {
    console.log('no event body')
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "No Body Found" }),
    };
  }
  console.log('event.body')
  console.log(event.body)

  // Get Issue
  const body = JSON.parse(event.body);
  const gitHubIssue = body.gitHubIssue;
  const gitHubIssueId = gitHubIssue.id;

  //   Get card mappings from database
  const { data, error } = await supabase
    .from("card-mapping")
    .select(
      "id, miroAppCardId::text, gitHubIssueId, miroUserId::text, gitHubUsername, created_at, miroBoardId, gitHubIssueNumber, auth ( access_token )"
    )
    .eq("gitHubIssueId", gitHubIssueId);

    console.log('data')
    console.log(data)


  //   No Miro App Card Found
  if (error) {
    console.log('this github issue IS NOT FOUND')
    return {
      statusCode: 200,
      body: JSON.stringify({
        message:
          "This GitHub issue doesn't have a corresponding Miro app card.",
      }),
    };
  }

  // Matching App Cards found
  if (data) {
    await Promise.all(
      data.map(async (item) => {
        // Request Headers
        const headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ` + process.env.MIRO_ACCESS_TOKEN,
        };

        console.log('before the path request, console body')
        console.log(body)

        //   Request options & body
        const options = {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({
            data: {
              title: gitHubIssue.title,
              description: gitHubIssue.body,
            },
          }),
        };

        return new Promise((resolve) => {
          try {
            const miroAppCardResponse = fetch(
              `https://api.miro.com/v2/boards/${item.miroBoardId}/app_cards/${item.miroAppCardId}`,
              options,
            );

            console.log('miroAppCardResponse: ')
            console.log(miroAppCardResponse)

            if (miroAppCardResponse.ok) {
              const data = miroAppCardResponse.json();
              const response = {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify(data),
              };
              resolve(response);
            } else {
              resolve({
                statusCode: miroAppCardResponse.status || 500,
                body: miroAppCardResponse.statusText,
              });
            }
          } catch (error) {
            resolve({
              statusCode: error.statusCode || 500,
              body: error.message,
            });
          }
        });
      }),
    );
  }

  // Final response
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Request sent" }),
  };
};
