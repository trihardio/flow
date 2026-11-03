// Flow's due-date reader (30 October 2026): the Mac's own on-device language model (Apple Intelligence, the
// FoundationModels framework) reads an assignment's due details, however they are written and however long the text,
// and picks out the words that say when it is due, its week, its weight and where to hand it in. Nothing leaves the Mac.
// It only copies words out of the text: the page turns them into a date and a time by its own rules (hlAsgRead) and
// drops any it can't find in the text, so a guess of the model's never becomes a deadline.
// Built by `npm run build-due-ai` into electron/due-ai; run by main.cjs (dueAI).
// In: one JSON object on stdin, { text }. Out: one JSON object on stdout, { day, time, week, weight, submit } or { error }.
import Foundation
import FoundationModels

func out(_ o: [String: Any]) -> Never {
  FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: o))
  exit(0)
}

// the fields, as a schema built at run time: the @Generable macro needs Xcode's macro plugin, which the Command Line
// Tools don't have
let fields: [(String, String)] = [
  ("day", "The words that give the day it is due or must be handed in (a date, a weekday, or words such as tomorrow). Not a release date, a reading date or a late date."),
  ("time", "The words that give the time of day it is due."),
  ("week", "The words that give the teaching week it is due in."),
  ("weight", "The words that give how much it counts towards the grade, as a percentage."),
  ("submit", "The words that say where or how to hand it in."),
]
let schema = try! GenerationSchema(root: DynamicGenerationSchema(name: "DueWords", properties: fields.map {
  DynamicGenerationSchema.Property(name: $0.0, description: $0.1, schema: DynamicGenerationSchema(type: String.self))
}), dependencies: [])

let raw = FileHandle.standardInput.readDataToEndOfFile()
guard let inp = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any], let text = inp["text"] as? String else { out(["error": "input"]) }
if case .unavailable(let why) = SystemLanguageModel.default.availability { out(["error": "unavailable", "why": "\(why)"]) }

let session = LanguageModelSession(instructions: """
You read what a student wrote about one assignment or test, and copy out the words that say when it is due, in which \
teaching week, how much it is worth and where to hand it in. Copy the words exactly as they are in the text, nothing \
added. When the text has several dates, take the one it is due on. Leave a field empty when the text does not say it.
""")
do {
  let r = try await session.respond(to: "The text:\n\(String(text.prefix(6000)))", schema: schema, options: GenerationOptions(temperature: 0))
  var o: [String: Any] = [:]
  for (k, _) in fields { o[k] = (try? r.content.value(String.self, forProperty: k)) ?? "" }
  out(o)
} catch {
  out(["error": "model", "why": "\(error)"])
}
