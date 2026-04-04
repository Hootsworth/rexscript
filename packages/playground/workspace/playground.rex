goal "Scrape product price" constraint { budget 0.05  timeout 30s } {
  attempt {
    observe page "https://www.amazon.in/Clay-Craft-Ceramic-Microwave-Gifting/dp/B0DWFW3CV3?crid=3RGRZ61HHXSNH&dib=eyJ2IjoiMSJ9.GYP1nrHpLeyrcmukTnbaHcg0iUQFvUIisMOa3iX7njuVVu6fXCG70bRtw2MdcraGvtuO0cert45pTWmAGrrtk_PZFk1WTq0b_WOJGfMCqs9Pp-tPKNh8UT-LiuGQIq7qUz5OexZFiOEHh47aj4KUsu938HqeQNqg30ulN85W7wojVRBnbdY4YMeKcwExXINj9exyqNtOvWfZv0tev8XYHmM6PqsJct5sxyzOH7R7Ba_x2dIgsXk0GW4VRPt0K1DL36XouRZlGJA_HcaSvLl2P8BX9Y-9l5tHRgqaOSSPorY.r1bmSK0wkI1YH4OKo3PxQsSF0Y7dOIy5ecX6pF5hDug&dib_tag=se&keywords=mug&qid=1775303511&sprefix=m%2Caps%2C412&sr=8-6&th=1" as $page
    when $page confidence < 0.6 {
      rationale "Sparse page, retrying"
      retry
    }

    find "price" in $page as $price
    
    console.log("PRICE:", $price);

    remember $price tagged "result"
    emit { action: "price_found", value: $price }

  } upto 3 recover Timeout {
    console.log("Timeout happened")
  } recover BlockedByBot {
    rotate proxy
    retry
  } otherwise * {
    console.log("Something failed")
    skip
  }
}